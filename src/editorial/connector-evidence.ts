import { DomainError } from "../domain/errors.js";
import { editorialContentHash } from "./adapters.js";
import type {
  EditorialArtifactResult,
  EditorialPreviewResolution,
} from "./delivery.js";
import {
  DEFAULT_EDITORIAL_GITHUB_BASE_BRANCH,
  DEFAULT_EDITORIAL_GITHUB_REPOSITORY,
  editorialArtifactBranch,
  editorialArtifactPaths,
} from "./github-publisher.js";
import { assertGitHubArtifactEvidence, assertReadyForPreviewEvidence } from "./state-machine.js";
import type { EditorialPublication } from "./types.js";
import { DEFAULT_EDITORIAL_VERCEL_PROJECT_ID } from "./vercel-preview.js";

type Fetcher = typeof fetch;

interface GitHubPullRequestEvidence {
  number?: number;
  state?: string;
  draft?: boolean;
  html_url?: string;
  created_at?: string;
  head?: {
    ref?: string;
    sha?: string;
    repo?: { full_name?: string };
  };
  base?: {
    ref?: string;
    repo?: { full_name?: string };
  };
}

interface EditorialArtifactMetadata {
  schema_version?: string;
  publication_id?: string;
  publication_version?: number;
  content_hash?: string;
  slug?: string;
  title?: string;
  assets?: string[];
}

interface DeploymentEvidencePayload {
  ok?: boolean;
  data?: {
    commit_sha?: string | null;
    branch?: string | null;
    repository?: string | null;
    deployment_url?: string | null;
    environment?: string | null;
    target_environment?: string | null;
    project_id?: string | null;
  };
}

export interface ConnectorEvidenceConfig {
  github_repository?: string;
  github_base_branch?: string;
  github_api_url?: string;
  github_raw_url?: string;
  vercel_project_id?: string;
  vercel_hostname_suffix?: string;
}

export interface ConnectorPreviewEvidenceInput {
  deployment_id: string;
  url: string;
}

function normalizedRepository(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function encodedPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isIsoTimestamp(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

export class EditorialConnectorEvidenceVerifier {
  private readonly githubRepository: string;
  private readonly githubBaseBranch: string;
  private readonly githubApiUrl: string;
  private readonly githubRawUrl: string;
  private readonly vercelProjectId: string;
  private readonly vercelHostnameSuffix: string;

  constructor(
    config: ConnectorEvidenceConfig = {},
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.githubRepository = (
      config.github_repository ?? DEFAULT_EDITORIAL_GITHUB_REPOSITORY
    ).trim();
    this.githubBaseBranch = (
      config.github_base_branch ?? DEFAULT_EDITORIAL_GITHUB_BASE_BRANCH
    ).trim();
    this.githubApiUrl = (
      config.github_api_url ?? "https://api.github.com"
    ).replace(/\/+$/, "");
    this.githubRawUrl = (
      config.github_raw_url ?? "https://raw.githubusercontent.com"
    ).replace(/\/+$/, "");
    this.vercelProjectId = (
      config.vercel_project_id ?? DEFAULT_EDITORIAL_VERCEL_PROJECT_ID
    ).trim();
    this.vercelHostnameSuffix = (
      config.vercel_hostname_suffix
      ?? "-oexecutor-9118s-projects.vercel.app"
    ).trim().toLowerCase();
  }

  async verifyArtifact(
    publication: EditorialPublication,
    pullRequestNumber: number,
  ): Promise<EditorialArtifactResult> {
    assertReadyForPreviewEvidence(publication);
    if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
      throw new DomainError(
        "E2_CONNECTOR_INVALID_INPUT",
        "O número do pull request é inválido.",
        "Informe o PR criado pelo conector GitHub.",
        422,
      );
    }

    const pullRequest = await this.fetchJson<GitHubPullRequestEvidence>(
      `${this.githubApiUrl}/repos/${this.githubRepository}/pulls/${pullRequestNumber}`,
      "E2_GITHUB_EVIDENCE_UNAVAILABLE",
      "Não foi possível verificar o pull request público no GitHub.",
    );
    const expectedBranch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const expectedPullRequestUrl =
      `https://github.com/${this.githubRepository}/pull/${pullRequestNumber}`;
    const repository = normalizedRepository(this.githubRepository);
    const commitSha = pullRequest.head?.sha?.trim() ?? "";
    if (
      pullRequest.number !== pullRequestNumber
      || pullRequest.state !== "open"
      || pullRequest.draft !== true
      || pullRequest.base?.ref !== this.githubBaseBranch
      || pullRequest.head?.ref !== expectedBranch
      || normalizedRepository(pullRequest.base?.repo?.full_name) !== repository
      || normalizedRepository(pullRequest.head?.repo?.full_name) !== repository
      || pullRequest.html_url !== expectedPullRequestUrl
      || !/^[0-9a-f]{40}$/i.test(commitSha)
      || !isIsoTimestamp(pullRequest.created_at)
    ) {
      throw new DomainError(
        "E2_GITHUB_EVIDENCE_MISMATCH",
        "O pull request não corresponde ao pacote editorial esperado.",
        "Confirme repositório, branch, base, estado draft e SHA do PR criado pelo conector.",
        409,
      );
    }

    const artifactPaths = editorialArtifactPaths(publication.content.slug);
    const rawBase = `${this.githubRawUrl}/${this.githubRepository}/${commitSha}`;
    const [markdownResponse, metadataResponse, coverResponse] = await Promise.all(
      [
        this.fetchEvidence(`${rawBase}/${encodedPath(artifactPaths[0])}`),
        this.fetchEvidence(`${rawBase}/${encodedPath(artifactPaths[1])}`),
        this.fetchEvidence(`${rawBase}/${encodedPath(artifactPaths[2])}`),
      ],
    );
    if (!markdownResponse.ok || !metadataResponse.ok || !coverResponse.ok) {
      throw new DomainError(
        "E2_ARTIFACT_EVIDENCE_MISSING",
        "O commit do PR não contém o pacote editorial completo.",
        "Grave artigo, metadados e capa no mesmo commit antes de registrar a E2.",
        409,
      );
    }

    const [markdown, metadataText] = await Promise.all([
      markdownResponse.text(),
      metadataResponse.text(),
    ]);
    let metadata: EditorialArtifactMetadata;
    try {
      metadata = JSON.parse(metadataText) as EditorialArtifactMetadata;
    } catch {
      throw new DomainError(
        "E2_ARTIFACT_METADATA_INVALID",
        "Os metadados do pacote editorial não são JSON válido.",
        "Gere novamente o arquivo .meta.json pelo contrato editorial 1.0.",
        409,
      );
    }

    const contentHash = editorialContentHash(publication);
    const coverPath = artifactPaths[2];
    if (
      markdown.trim() !== publication.content.markdown.trim()
      || metadata.schema_version !== "1.0"
      || metadata.publication_id !== publication.id
      || metadata.publication_version !== publication.version
      || metadata.content_hash !== contentHash
      || metadata.slug !== publication.content.slug
      || metadata.title !== publication.briefing.title
      || !Array.isArray(metadata.assets)
      || !metadata.assets.includes(coverPath)
    ) {
      throw new DomainError(
        "E2_ARTIFACT_CONTENT_MISMATCH",
        "O conteúdo ou os metadados do commit diferem da versão aprovada na E1.",
        "Recrie o pacote GitHub usando exatamente o markdown, a versão e o hash atuais.",
        409,
      );
    }

    return {
      branch: expectedBranch,
      commit_sha: commitSha,
      pull_request_number: pullRequestNumber,
      pull_request_url: expectedPullRequestUrl,
      artifact_paths: artifactPaths,
      created_at: pullRequest.created_at,
    };
  }

  async verifyPreview(
    publication: EditorialPublication,
    input: ConnectorPreviewEvidenceInput,
  ): Promise<Extract<EditorialPreviewResolution, { state: "READY" }>> {
    assertGitHubArtifactEvidence(publication);
    const expectedCommitSha = publication.github.commit_sha;
    if (!expectedCommitSha) {
      throw this.previewMismatch("O pacote GitHub não contém um commit verificável.");
    }
    const deploymentId = input.deployment_id.trim();
    let deploymentUrl: URL;
    try {
      deploymentUrl = new URL(input.url.trim());
    } catch {
      throw this.previewMismatch("A URL do deployment é inválida.");
    }
    const hostname = deploymentUrl.hostname.toLowerCase();
    if (
      deploymentUrl.protocol !== "https:"
      || deploymentUrl.username
      || deploymentUrl.password
      || deploymentUrl.port
      || deploymentUrl.pathname !== "/"
      || deploymentUrl.search
      || deploymentUrl.hash
      || !hostname.endsWith(this.vercelHostnameSuffix)
      || !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)
    ) {
      throw this.previewMismatch(
        "Use a URL imutável do Preview no escopo Vercel autorizado e o deployment dpl_ correspondente.",
      );
    }

    const evidence = await this.fetchJson<DeploymentEvidencePayload>(
      `${deploymentUrl.origin}/api/deployment-evidence`,
      "E2_PREVIEW_EVIDENCE_UNAVAILABLE",
      "O deployment não forneceu evidência verificável.",
    );
    const data = evidence.data;
    const expectedRepository = normalizedRepository(
      DEFAULT_EDITORIAL_GITHUB_REPOSITORY,
    );
    const environment = data?.environment?.trim().toLowerCase() ?? "";
    const targetEnvironment =
      data?.target_environment?.trim().toLowerCase() ?? "";
    if (
      evidence.ok !== true
      || !data
      || data.commit_sha !== expectedCommitSha
      || data.branch !== publication.github.branch
      || normalizedRepository(data.repository ?? undefined) !== expectedRepository
      || data.deployment_url?.toLowerCase() !== hostname
      || data.project_id !== this.vercelProjectId
      || environment !== "preview"
      || targetEnvironment === "production"
    ) {
      throw this.previewMismatch(
        "SHA, branch, repositório, projeto ou ambiente do deployment não correspondem ao PR aprovado.",
      );
    }

    return {
      state: "READY",
      deployment_id: deploymentId,
      url: deploymentUrl.origin,
      commit_sha: expectedCommitSha,
      created_at: new Date().toISOString(),
    };
  }

  private async fetchEvidence(url: string): Promise<Response> {
    try {
      return await this.fetcher(url, {
        headers: {
          Accept: "*/*",
          "User-Agent": "EXECUTA-AI-Editorial-Evidence/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new DomainError(
        "E2_EXTERNAL_EVIDENCE_UNAVAILABLE",
        "Não foi possível consultar a evidência externa da E2.",
        "Tente novamente depois de confirmar a disponibilidade do GitHub e da Vercel.",
        502,
      );
    }
  }

  private async fetchJson<T>(
    url: string,
    code: string,
    message: string,
  ): Promise<T> {
    const response = await this.fetchEvidence(url);
    if (!response.ok) {
      throw new DomainError(
        code,
        message,
        `A fonte de evidência respondeu HTTP ${response.status}.`,
        response.status === 404 ? 409 : 502,
      );
    }
    try {
      return await response.json() as T;
    } catch {
      throw new DomainError(
        code,
        message,
        "A fonte de evidência não retornou JSON válido.",
        502,
      );
    }
  }

  private previewMismatch(detail: string): DomainError {
    return new DomainError(
      "E2_PREVIEW_EVIDENCE_MISMATCH",
      "O deployment informado não corresponde ao Preview editorial aprovado.",
      detail,
      409,
    );
  }
}
