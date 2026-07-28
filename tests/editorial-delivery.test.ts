import { describe, expect, it, vi } from "vitest";
import type { EditorialArtifactInput } from "../src/editorial/delivery.js";
import { GitHubEditorialPublisher } from "../src/editorial/github-publisher.js";
import type { EditorialPublication } from "../src/editorial/types.js";
import { VercelEditorialPreviewResolver } from "../src/editorial/vercel-preview.js";

function publication(): EditorialPublication {
  return {
    id: "PUB-20260728-delivery",
    version: 2,
    status: "READY_FOR_PREVIEW",
    briefing: {
      title: "E2 GitHub e Vercel Preview",
      summary: "Pacote automático da publicação.",
      audience: "Equipe editorial",
      objective: "Comprovar a E2 canônica.",
      author: "Leonardo",
      source_text: "# E2 GitHub e Vercel Preview\n\nConteúdo.\n\n## Entrega\n\nPreview.",
      keywords: ["E2"],
      channel: "EXECUTA_JOURNAL",
      language: "pt-BR",
    },
    content: {
      slug: "e2-github-vercel-preview",
      excerpt: "Pacote automático da publicação.",
      markdown: "# E2 GitHub e Vercel Preview\n\nO pacote editorial aprovado é gravado automaticamente no repositório.\n\n## Entrega\n\nBranch, commit, PR e Preview permanecem vinculados pelo mesmo hash.",
      reading_time_minutes: 1,
      generated_at: null,
      updated_at: "2026-07-28T10:00:00.000Z",
    },
    quality: {
      valid: true,
      gate_result: "PASSED",
      score: 95,
      errors: [],
      warnings: [],
      checked_at: "2026-07-28T10:01:00.000Z",
      content_hash: "f".repeat(64),
      adapters: {
        deskgo: {} as EditorialPublication["quality"]["adapters"]["deskgo"],
        frankwatching: {} as EditorialPublication["quality"]["adapters"]["frankwatching"],
        ames: {} as EditorialPublication["quality"]["adapters"]["ames"],
      },
    },
    github: {
      branch: null,
      pull_request_number: null,
      pull_request_url: null,
      commit_sha: null,
      publication_version: null,
      content_hash: null,
      artifact_contract_version: null,
      artifact_paths: [],
      created_at: null,
    },
    preview: {
      deployment_id: null,
      url: null,
      created_at: null,
      commit_sha: null,
    },
    approval: {
      decision: "PENDING",
      reviewer: null,
      note: null,
      decided_at: null,
      approved_commit_sha: null,
    },
    publication: { url: null, published_at: null, commit_sha: null },
    qr: {
      create_url: null,
      preview_url: null,
      approve_url: null,
      analytics_url: null,
      routes: { CREATE: null, PREVIEW: null, APPROVE: null, ANALYTICS: null },
      issued_at: null,
    },
    events: [],
    created_at: "2026-07-28T09:00:00.000Z",
    updated_at: "2026-07-28T10:01:00.000Z",
  };
}

function artifactInput(): EditorialArtifactInput {
  return {
    publication: publication(),
    content_hash: "f".repeat(64),
  };
}

describe("GitHubEditorialPublisher", () => {
  it("writes article, metadata and cover, then creates branch, commit and draft PR", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown; authorization?: string }> = [];
    const baseCommit = "1".repeat(40);
    const commitSha = "2".repeat(40);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      const headers = new Headers(init?.headers);
      calls.push({ url, method, body, authorization: headers.get("Authorization") ?? undefined });

      if (method === "GET" && url.endsWith("/git/ref/heads/main")) {
        return Response.json({ object: { sha: baseCommit } });
      }
      if (method === "GET" && url.includes("/git/ref/heads/editorial/")) {
        return new Response(null, { status: 404 });
      }
      if (method === "GET" && url.endsWith(`/git/commits/${baseCommit}`)) {
        return Response.json({ sha: baseCommit, tree: { sha: "tree-base" } });
      }
      if (method === "POST" && url.endsWith("/git/trees")) {
        return Response.json({ sha: "tree-package" }, { status: 201 });
      }
      if (method === "POST" && url.endsWith("/git/commits")) {
        return Response.json({ sha: commitSha }, { status: 201 });
      }
      if (method === "POST" && url.endsWith("/git/refs")) {
        return Response.json({ object: { sha: commitSha } }, { status: 201 });
      }
      if (method === "GET" && url.includes("/pulls?")) return Response.json([]);
      if (method === "POST" && url.endsWith("/pulls")) {
        return Response.json({
          number: 44,
          html_url: "https://github.com/oexecutor/P1.Executar.ai/pull/44",
        }, { status: 201 });
      }
      return Response.json({ message: "unexpected request" }, { status: 500 });
    }) as unknown as typeof fetch;
    const publisher = new GitHubEditorialPublisher({
      token: "github-secret",
      repository: "oexecutor/P1.Executar.ai",
      base_branch: "main",
      api_url: "https://github.test",
    }, fetcher);

    const result = await publisher.publish(artifactInput());

    expect(result).toMatchObject({
      branch: "editorial/pub-20260728-delivery-e2-github-vercel-preview",
      commit_sha: commitSha,
      pull_request_number: 44,
      pull_request_url: "https://github.com/oexecutor/P1.Executar.ai/pull/44",
    });
    expect(result.artifact_paths).toEqual([
      "content/blog/e2-github-vercel-preview.md",
      "content/blog/e2-github-vercel-preview.meta.json",
      "public/blog/e2-github-vercel-preview/cover.svg",
    ]);

    const treeRequest = calls.find((call) => call.method === "POST" && call.url.endsWith("/git/trees"));
    const treeEntries = (treeRequest?.body as { tree: Array<{ path: string; content: string }> }).tree;
    expect(treeEntries.map((entry) => entry.path)).toEqual(result.artifact_paths);
    expect(treeEntries[0]?.content).toContain("# E2 GitHub e Vercel Preview");
    expect(JSON.parse(treeEntries[1]?.content ?? "{}")).toMatchObject({
      publication_id: "PUB-20260728-delivery",
      publication_version: 2,
      content_hash: "f".repeat(64),
    });
    expect(treeEntries[2]?.content).toContain("<svg");
    expect(calls.every((call) => call.authorization === "Bearer github-secret")).toBe(true);
  });

  it("is idempotent when the branch tree and open PR already match", async () => {
    const methods: string[] = [];
    const existingCommit = "3".repeat(40);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      methods.push(`${method} ${new URL(url).pathname}`);
      if (url.endsWith("/git/ref/heads/main")) {
        return Response.json({ object: { sha: "1".repeat(40) } });
      }
      if (url.includes("/git/ref/heads/editorial/")) {
        return Response.json({ object: { sha: existingCommit } });
      }
      if (url.endsWith(`/git/commits/${existingCommit}`)) {
        return Response.json({ sha: existingCommit, tree: { sha: "tree-existing" } });
      }
      if (method === "POST" && url.endsWith("/git/trees")) {
        return Response.json({ sha: "tree-existing" }, { status: 201 });
      }
      if (method === "GET" && url.includes("/pulls?")) {
        return Response.json([{
          number: 44,
          html_url: "https://github.com/oexecutor/P1.Executar.ai/pull/44",
        }]);
      }
      return Response.json({ message: "unexpected request" }, { status: 500 });
    }) as unknown as typeof fetch;
    const publisher = new GitHubEditorialPublisher({
      token: "github-secret",
      repository: "oexecutor/P1.Executar.ai",
      base_branch: "main",
      api_url: "https://github.test",
    }, fetcher);

    const result = await publisher.publish(artifactInput());

    expect(result.commit_sha).toBe(existingCommit);
    expect(methods).not.toContain("POST /repos/oexecutor/P1.Executar.ai/git/commits");
    expect(methods.some((entry) => entry.startsWith("PATCH "))).toBe(false);
    expect(methods).not.toContain("POST /repos/oexecutor/P1.Executar.ai/pulls");
  });

  it("returns a typed failure without exposing the token", async () => {
    const publisher = new GitHubEditorialPublisher({
      token: "do-not-leak",
      repository: "oexecutor/P1.Executar.ai",
      base_branch: "main",
      api_url: "https://github.test",
    }, vi.fn(async () =>
      Response.json({ message: "Bad credentials" }, { status: 401 })
    ) as unknown as typeof fetch);

    await expect(publisher.publish(artifactInput())).rejects.toMatchObject({
      code: "E2_GITHUB_REJECTED",
      status: 503,
    });
    await expect(publisher.publish(artifactInput())).rejects.not.toThrow(/do-not-leak/);
  });
});

describe("VercelEditorialPreviewResolver", () => {
  it("captures only the non-production deployment for the exact commit", async () => {
    const commitSha = "4".repeat(40);
    let requestedUrl = "";
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return Response.json({
        deployments: [
          {
            id: "dpl_production",
            url: "production.vercel.app",
            state: "READY",
            target: "production",
            created: 2,
            meta: { githubCommitSha: commitSha },
          },
          {
            id: "dpl_preview",
            url: "immutable-preview.vercel.app",
            state: "READY",
            target: null,
            created: 1,
            meta: { githubCommitSha: commitSha },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const resolver = new VercelEditorialPreviewResolver({
      token: "vercel-secret",
      project_id: "prj_test",
      team_id: "team_test",
      api_url: "https://vercel.test",
    }, fetcher);

    await expect(resolver.resolve({
      branch: "editorial/test",
      commit_sha: commitSha,
    })).resolves.toEqual({
      state: "READY",
      deployment_id: "dpl_preview",
      url: "https://immutable-preview.vercel.app",
      commit_sha: commitSha,
      created_at: new Date(1).toISOString(),
    });
    const query = new URL(requestedUrl).searchParams;
    expect(query.get("projectId")).toBe("prj_test");
    expect(query.get("teamId")).toBe("team_test");
    expect(query.get("sha")).toBe(commitSha);
    expect(query.get("branch")).toBe("editorial/test");
  });

  it.each([
    [[], { state: "PENDING" }],
    [[{
      id: "dpl_failed",
      url: "failed.vercel.app",
      state: "ERROR",
      target: null,
      created: 1,
      meta: { githubCommitSha: "5".repeat(40) },
    }], { state: "FAILED", detail: "Deployment dpl_failed terminou em ERROR." }],
  ])("maps Vercel deployment state without accepting manual evidence", async (deployments, expected) => {
    const resolver = new VercelEditorialPreviewResolver({
      token: "vercel-secret",
      project_id: "prj_test",
      team_id: "team_test",
      api_url: "https://vercel.test",
    }, vi.fn(async () => Response.json({ deployments })) as unknown as typeof fetch);

    await expect(resolver.resolve({
      branch: "editorial/test",
      commit_sha: "5".repeat(40),
    })).resolves.toEqual(expected);
  });
});
