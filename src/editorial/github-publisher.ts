import { DomainError } from "../domain/errors.js";
import type {
  EditorialArtifactInput,
  EditorialArtifactPublisher,
  EditorialArtifactResult,
} from "./delivery.js";

type Fetcher = typeof fetch;

export const DEFAULT_EDITORIAL_GITHUB_REPOSITORY =
  "oexecutor/P1.Executar.ai";
export const DEFAULT_EDITORIAL_GITHUB_BASE_BRANCH = "main";

export interface GitHubEditorialPublisherConfig {
  token: string;
  repository: string;
  base_branch: string;
  api_url?: string;
}

interface GitHubReference {
  object?: { sha?: string };
}

interface GitHubCommit {
  sha?: string;
  tree?: { sha?: string };
}

interface GitHubTree {
  sha?: string;
}

interface GitHubPullRequest {
  number?: number;
  html_url?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function editorialArtifactBranch(
  publicationId: string,
  slug: string,
): string {
  return `editorial/${publicationId.toLowerCase()}-${slug}`.slice(0, 220);
}

export function editorialArtifactPaths(slug: string): [string, string, string] {
  return [
    `content/blog/${slug}.md`,
    `content/blog/${slug}.meta.json`,
    `public/blog/${slug}/cover.svg`,
  ];
}

function coverSvg(title: string, publicationId: string): string {
  const safeTitle = escapeXml(title);
  const safePublicationId = escapeXml(publicationId);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title description">
  <title id="title">${safeTitle}</title>
  <desc id="description">Capa editorial gerada para ${safePublicationId}.</desc>
  <rect width="1600" height="900" fill="#efefeb"/>
  <rect x="80" y="80" width="1440" height="740" fill="#fafaf7" stroke="#202020" stroke-width="4"/>
  <rect x="80" y="80" width="32" height="740" fill="#ff5a00"/>
  <text x="160" y="205" fill="#ff5a00" font-family="ui-monospace, monospace" font-size="34" font-weight="700">EXECUTA JOURNAL · PREVIEW</text>
  <foreignObject x="160" y="270" width="1260" height="360">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 800 76px/1.08 system-ui, sans-serif; color: #202020;">${safeTitle}</div>
  </foreignObject>
  <text x="160" y="730" fill="#62625d" font-family="ui-monospace, monospace" font-size="28">${safePublicationId}</text>
</svg>
`;
}

function metadata(input: EditorialArtifactInput, artifactPaths: string[]) {
  const { publication, content_hash: contentHash } = input;
  return {
    schema_version: "1.0",
    publication_id: publication.id,
    publication_version: publication.version,
    content_hash: contentHash,
    slug: publication.content.slug,
    title: publication.briefing.title,
    excerpt: publication.content.excerpt,
    author: publication.briefing.author,
    category: "Produto",
    language: publication.briefing.language,
    channel: publication.briefing.channel,
    reading_minutes: publication.content.reading_time_minutes,
    updated_at: publication.content.updated_at,
    quality_checked_at: publication.quality.checked_at,
    cover_pattern: "steps",
    cover_label: `PREVIEW / ${publication.id}`,
    assets: artifactPaths.filter((path) => path.startsWith("public/")),
  };
}

export class GitHubEditorialPublisher implements EditorialArtifactPublisher {
  private readonly owner: string;
  private readonly repo: string;
  private readonly apiUrl: string;

  constructor(
    private readonly config: GitHubEditorialPublisherConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {
    const [owner, repo, ...extra] = config.repository.trim().split("/");
    if (!owner || !repo || extra.length > 0) {
      throw new Error("EDITORIAL_GITHUB_REPOSITORY must use owner/name.");
    }
    if (!config.token.trim()) throw new Error("EDITORIAL_GITHUB_TOKEN is required.");
    if (!config.base_branch.trim()) throw new Error("EDITORIAL_GITHUB_BASE_BRANCH is required.");
    this.owner = owner;
    this.repo = repo;
    this.apiUrl = (config.api_url ?? "https://api.github.com").replace(/\/+$/, "");
  }

  async publish(input: EditorialArtifactInput): Promise<EditorialArtifactResult> {
    const { publication } = input;
    const branch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
    const baseBranch = this.config.base_branch.trim();

    const baseReference = await this.request<GitHubReference>(
      "GET",
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    );
    const baseCommitSha = baseReference.object?.sha;
    if (!baseCommitSha) throw this.invalidResponse("A referência da branch base não contém commit.");

    const branchResponse = await this.request<GitHubReference>(
      "GET",
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${encodedBranch}`,
      undefined,
      [404],
    );
    const branchCommitSha = branchResponse.object?.sha;
    const parentCommitSha = branchCommitSha ?? baseCommitSha;
    const parentCommit = await this.request<GitHubCommit>(
      "GET",
      `/repos/${this.owner}/${this.repo}/git/commits/${parentCommitSha}`,
    );
    const parentTreeSha = parentCommit.tree?.sha;
    if (!parentTreeSha) throw this.invalidResponse("O commit de origem não contém tree SHA.");

    const artifactPaths = editorialArtifactPaths(publication.content.slug);
    const [markdownPath, metadataPath, coverPath] = artifactPaths;
    const tree = await this.request<GitHubTree>(
      "POST",
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        base_tree: parentTreeSha,
        tree: [
          {
            path: markdownPath,
            mode: "100644",
            type: "blob",
            content: `${publication.content.markdown.trim()}\n`,
          },
          {
            path: metadataPath,
            mode: "100644",
            type: "blob",
            content: `${JSON.stringify(metadata(input, artifactPaths), null, 2)}\n`,
          },
          {
            path: coverPath,
            mode: "100644",
            type: "blob",
            content: coverSvg(publication.briefing.title, publication.id),
          },
        ],
      },
    );
    if (!tree.sha) throw this.invalidResponse("A criação do pacote não retornou tree SHA.");

    let commitSha = parentCommitSha;
    if (tree.sha !== parentTreeSha) {
      const commit = await this.request<GitHubCommit>(
        "POST",
        `/repos/${this.owner}/${this.repo}/git/commits`,
        {
          message: `feat(editorial): preparar ${publication.id} v${publication.version}`,
          tree: tree.sha,
          parents: [parentCommitSha],
        },
      );
      if (!commit.sha) throw this.invalidResponse("A criação do commit não retornou SHA.");
      commitSha = commit.sha;
    }

    if (!branchCommitSha) {
      await this.request(
        "POST",
        `/repos/${this.owner}/${this.repo}/git/refs`,
        { ref: `refs/heads/${branch}`, sha: commitSha },
      );
    } else if (commitSha !== branchCommitSha) {
      await this.request(
        "PATCH",
        `/repos/${this.owner}/${this.repo}/git/refs/heads/${encodedBranch}`,
        { sha: commitSha, force: false },
      );
    }

    const openPullRequests = await this.request<GitHubPullRequest[]>(
      "GET",
      `/repos/${this.owner}/${this.repo}/pulls?state=open&head=${encodeURIComponent(`${this.owner}:${branch}`)}&base=${encodeURIComponent(baseBranch)}`,
    );
    const pullRequest = openPullRequests[0] ?? await this.request<GitHubPullRequest>(
      "POST",
      `/repos/${this.owner}/${this.repo}/pulls`,
      {
        title: `Editorial: ${publication.briefing.title}`,
        head: branch,
        base: baseBranch,
        draft: true,
        maintainer_can_modify: true,
        body: [
          `Publicação: \`${publication.id}\``,
          `Versão editorial: \`${publication.version}\``,
          `Hash aprovado: \`${input.content_hash}\``,
          "",
          "Artefatos:",
          ...artifactPaths.map((path) => `- \`${path}\``),
          "",
          "- [x] E1: pacote e gate interno concluídos",
          "- [x] E2: branch, commit e PR criados automaticamente",
          "- [ ] E2: Vercel Preview capturado para este SHA",
          "- [ ] E3: revisão e aprovação humana",
          "",
          "Não fazer merge sem aprovação humana explícita no painel editorial.",
          "",
          "Refs #23",
        ].join("\n"),
      },
    );
    if (!pullRequest.number || !pullRequest.html_url) {
      throw this.invalidResponse("A criação ou consulta do PR não retornou número e URL.");
    }

    return {
      branch,
      commit_sha: commitSha,
      pull_request_number: pullRequest.number,
      pull_request_url: pullRequest.html_url,
      artifact_paths: artifactPaths,
      created_at: new Date().toISOString(),
    };
  }

  private invalidResponse(detail: string): DomainError {
    return new DomainError(
      "E2_GITHUB_INVALID_RESPONSE",
      "O GitHub retornou uma resposta incompleta durante a E2.",
      detail,
      502,
    );
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    allowedStatuses: number[] = [],
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiUrl}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new DomainError(
        "E2_GITHUB_UNAVAILABLE",
        "Não foi possível concluir a operação automática no GitHub.",
        "Verifique conectividade, credencial e permissões Contents:write e Pull requests:write.",
        502,
      );
    }

    if (allowedStatuses.includes(response.status)) return {} as T;
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: unknown };
      const reason = typeof payload.message === "string"
        ? payload.message.slice(0, 240)
        : `HTTP ${response.status}`;
      throw new DomainError(
        "E2_GITHUB_REJECTED",
        "O GitHub rejeitou a criação automática do artefato editorial.",
        `GitHub: ${reason}. Confirme a branch base e as permissões do token.`,
        response.status === 401 || response.status === 403 ? 503 : 502,
      );
    }
    if (response.status === 204) return {} as T;
    return await response.json() as T;
  }
}

export function githubEditorialPublisherFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): GitHubEditorialPublisher | null {
  const token = environment.EDITORIAL_GITHUB_TOKEN?.trim()
    || environment.GITHUB_TOKEN?.trim()
    || environment.GH_TOKEN?.trim();
  if (!token) return null;
  const repository = environment.EDITORIAL_GITHUB_REPOSITORY?.trim()
    || DEFAULT_EDITORIAL_GITHUB_REPOSITORY;
  const baseBranch = environment.EDITORIAL_GITHUB_BASE_BRANCH?.trim()
    || DEFAULT_EDITORIAL_GITHUB_BASE_BRANCH;
  return new GitHubEditorialPublisher({
    token,
    repository,
    base_branch: baseBranch,
  });
}
