import { DomainError } from "../domain/errors.js";
import type {
  EditorialPreviewResolution,
  EditorialPreviewResolver,
} from "./delivery.js";

type Fetcher = typeof fetch;

export interface VercelEditorialPreviewConfig {
  token: string;
  project_id: string;
  team_id: string;
  api_url?: string;
}

interface VercelDeployment {
  uid?: string;
  id?: string;
  url?: string | null;
  created?: number;
  createdAt?: number;
  state?: string;
  readyState?: string;
  target?: string | null;
  meta?: {
    githubCommitSha?: string;
  };
}

interface VercelDeploymentsResponse {
  deployments?: VercelDeployment[];
}

export class VercelEditorialPreviewResolver implements EditorialPreviewResolver {
  private readonly apiUrl: string;

  constructor(
    private readonly config: VercelEditorialPreviewConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {
    if (!config.token.trim()) throw new Error("EDITORIAL_VERCEL_TOKEN is required.");
    if (!/^prj_/.test(config.project_id)) throw new Error("EDITORIAL_VERCEL_PROJECT_ID must start with prj_.");
    if (!/^team_/.test(config.team_id)) throw new Error("EDITORIAL_VERCEL_TEAM_ID must start with team_.");
    this.apiUrl = (config.api_url ?? "https://api.vercel.com").replace(/\/+$/, "");
  }

  async resolve(input: {
    branch: string;
    commit_sha: string;
  }): Promise<EditorialPreviewResolution> {
    const query = new URLSearchParams({
      projectId: this.config.project_id,
      teamId: this.config.team_id,
      sha: input.commit_sha,
      branch: input.branch,
      limit: "20",
    });
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}/v7/deployments?${query}`, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new DomainError(
        "E2_VERCEL_UNAVAILABLE",
        "Não foi possível consultar o Vercel Preview.",
        "Verifique conectividade, token e escopo do projeto Vercel.",
        502,
      );
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as {
        error?: { message?: unknown };
      };
      const reason = typeof payload.error?.message === "string"
        ? payload.error.message.slice(0, 240)
        : `HTTP ${response.status}`;
      throw new DomainError(
        "E2_VERCEL_REJECTED",
        "A Vercel rejeitou a consulta automática do Preview.",
        `Vercel: ${reason}. Confirme token, team e project ID.`,
        response.status === 401 || response.status === 403 ? 503 : 502,
      );
    }

    const payload = await response.json() as VercelDeploymentsResponse;
    const exactDeployments = (payload.deployments ?? []).filter((deployment) =>
      deployment.meta?.githubCommitSha === input.commit_sha
      && deployment.target !== "production"
    );
    const deployment = exactDeployments.sort((left, right) =>
      (right.created ?? right.createdAt ?? 0) - (left.created ?? left.createdAt ?? 0)
    )[0];
    if (!deployment) return { state: "PENDING" };

    const state = deployment.state ?? deployment.readyState ?? "QUEUED";
    if (["ERROR", "CANCELED", "BLOCKED"].includes(state)) {
      return {
        state: "FAILED",
        detail: `Deployment ${deployment.id ?? deployment.uid ?? "desconhecido"} terminou em ${state}.`,
      };
    }
    const deploymentId = deployment.id ?? deployment.uid;
    if (state !== "READY" || !deploymentId || !deployment.url) return { state: "PENDING" };
    const created = deployment.created ?? deployment.createdAt ?? Date.now();
    return {
      state: "READY",
      deployment_id: deploymentId,
      url: `https://${deployment.url.replace(/^https?:\/\//, "")}`,
      commit_sha: input.commit_sha,
      created_at: new Date(created).toISOString(),
    };
  }
}

export function vercelEditorialPreviewResolverFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): VercelEditorialPreviewResolver | null {
  const token = environment.EDITORIAL_VERCEL_TOKEN?.trim();
  const projectId = environment.EDITORIAL_VERCEL_PROJECT_ID?.trim();
  const teamId = environment.EDITORIAL_VERCEL_TEAM_ID?.trim();
  if (!token || !projectId || !teamId) return null;
  return new VercelEditorialPreviewResolver({
    token,
    project_id: projectId,
    team_id: teamId,
  });
}
