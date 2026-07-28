import { describe, expect, it, vi } from "vitest";
import {
  deploymentEvidence,
  deploymentEvidenceHandler,
} from "../api/deployment-evidence.js";
import { editorialAdapterRegistry } from "../src/editorial/adapters.js";
import { EditorialConnectorEvidenceVerifier } from "../src/editorial/connector-evidence.js";
import {
  editorialArtifactBranch,
  editorialArtifactPaths,
} from "../src/editorial/github-publisher.js";
import { EditorialService } from "../src/editorial/service.js";
import { EditorialStore } from "../src/editorial/store.js";
import type { EditorialPublication } from "../src/editorial/types.js";
import { memoryStore } from "./helpers/memory-store.js";

const sourceText = `# Homologação do QR semântico P0

## Objetivo

Esta publicação comprova que o pacote editorial aprovado permanece ligado ao mesmo commit usado pelo Preview e pela publicação.

## Fluxo verificável

O conector cria branch, commit e pull request. O servidor compara os arquivos públicos com o hash da E1 antes de aceitar a evidência.

## Resultado

Somente o deployment de Preview do SHA aprovado pode seguir para revisão humana.`;

async function readyPublication(): Promise<{
  service: EditorialService;
  publication: EditorialPublication;
}> {
  const service = new EditorialService(
    new EditorialStore(memoryStore()),
    editorialAdapterRegistry,
  );
  const created = await service.createPublication({
    title: "Homologação do QR semântico P0",
    summary: "Evidência ponta a ponta da publicação e dos quatro QRs.",
    audience: "Equipe editorial",
    objective: "Homologar a E2 oficial e a camada P0 de QR.",
    author: "Leonardo Batista",
    source_text: sourceText,
  });
  await service.runAdapters(created.id, "Leonardo Batista");
  return {
    service,
    publication: await service.runQualityGate(
      created.id,
      "Leonardo Batista",
    ),
  };
}

function artifactMetadata(publication: EditorialPublication) {
  const paths = editorialArtifactPaths(publication.content.slug);
  return {
    schema_version: "1.0",
    publication_id: publication.id,
    publication_version: publication.version,
    content_hash: publication.quality.content_hash,
    slug: publication.content.slug,
    title: publication.briefing.title,
    assets: [paths[2]],
  };
}

describe("EditorialConnectorEvidenceVerifier", () => {
  it("accepts a draft PR only after matching branch, SHA, markdown, metadata and cover", async () => {
    const { service, publication } = await readyPublication();
    const commitSha = "a".repeat(40);
    const branch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://github.test/repos/oexecutor/P1.Executar.ai/pulls/51") {
        return Response.json({
          number: 51,
          state: "open",
          draft: true,
          html_url: "https://github.com/oexecutor/P1.Executar.ai/pull/51",
          created_at: "2026-07-28T14:00:00.000Z",
          head: {
            ref: branch,
            sha: commitSha,
            repo: { full_name: "oexecutor/P1.Executar.ai" },
          },
          base: {
            ref: "main",
            repo: { full_name: "oexecutor/P1.Executar.ai" },
          },
        });
      }
      if (url.endsWith(".md")) return new Response(`${publication.content.markdown}\n`);
      if (url.endsWith(".meta.json")) {
        return Response.json(artifactMetadata(publication));
      }
      if (url.endsWith("/cover.svg")) return new Response("<svg></svg>");
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;
    const verifier = new EditorialConnectorEvidenceVerifier({
      github_api_url: "https://github.test",
      github_raw_url: "https://raw.test",
    }, fetcher);

    const artifact = await verifier.verifyArtifact(publication, 51);
    expect(artifact).toMatchObject({
      branch,
      commit_sha: commitSha,
      pull_request_number: 51,
    });

    const building = await service.registerVerifiedArtifact(
      publication.id,
      artifact,
      "Conector GitHub",
    );
    expect(building.status).toBe("PREVIEW_BUILDING");
    expect(building.github.content_hash).toBe(publication.quality.content_hash);
  });

  it("rejects a PR whose metadata does not match the E1 content hash", async () => {
    const { publication } = await readyPublication();
    const branch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/pulls/52")) {
        return Response.json({
          number: 52,
          state: "open",
          draft: true,
          html_url: "https://github.com/oexecutor/P1.Executar.ai/pull/52",
          created_at: "2026-07-28T14:00:00.000Z",
          head: {
            ref: branch,
            sha: "b".repeat(40),
            repo: { full_name: "oexecutor/P1.Executar.ai" },
          },
          base: {
            ref: "main",
            repo: { full_name: "oexecutor/P1.Executar.ai" },
          },
        });
      }
      if (url.endsWith(".md")) return new Response(publication.content.markdown);
      if (url.endsWith(".meta.json")) {
        return Response.json({
          ...artifactMetadata(publication),
          content_hash: "0".repeat(64),
        });
      }
      return new Response("<svg></svg>");
    }) as unknown as typeof fetch;
    const verifier = new EditorialConnectorEvidenceVerifier({
      github_api_url: "https://github.test",
      github_raw_url: "https://raw.test",
    }, fetcher);

    await expect(verifier.verifyArtifact(publication, 52))
      .rejects.toMatchObject({ code: "E2_ARTIFACT_CONTENT_MISMATCH" });
  });

  it("accepts only a Preview deployment that proves the approved SHA and branch", async () => {
    const { service, publication } = await readyPublication();
    const commitSha = "c".repeat(40);
    const branch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const building = await service.registerVerifiedArtifact(
      publication.id,
      {
        branch,
        commit_sha: commitSha,
        pull_request_number: 53,
        pull_request_url: "https://github.com/oexecutor/P1.Executar.ai/pull/53",
        artifact_paths: editorialArtifactPaths(publication.content.slug),
        created_at: "2026-07-28T14:00:00.000Z",
      },
      "Conector GitHub",
    );
    const fetcher = vi.fn(async () => Response.json({
      ok: true,
      data: {
        commit_sha: commitSha,
        branch,
        repository: "oexecutor/P1.Executar.ai",
        deployment_url: "editorial-preview-team.vercel.app",
        environment: "preview",
        target_environment: "preview",
        project_id: "prj_test",
      },
    })) as unknown as typeof fetch;
    const verifier = new EditorialConnectorEvidenceVerifier({
      vercel_project_id: "prj_test",
      vercel_hostname_suffix: "-team.vercel.app",
    }, fetcher);

    const resolution = await verifier.verifyPreview(building, {
      deployment_id: "dpl_verified123",
      url: "https://editorial-preview-team.vercel.app",
    });
    const ready = await service.registerVerifiedPreview(
      publication.id,
      resolution,
      "Conector Vercel",
    );

    expect(ready.status).toBe("PREVIEW_READY");
    expect(ready.preview).toMatchObject({
      deployment_id: "dpl_verified123",
      commit_sha: commitSha,
    });
  });

  it.each([
    ["d".repeat(40), "preview"],
    ["c".repeat(40), "production"],
  ])("rejects Preview evidence with a mismatched SHA or production environment", async (
    evidencedSha,
    environment,
  ) => {
    const { service, publication } = await readyPublication();
    const commitSha = "c".repeat(40);
    const branch = editorialArtifactBranch(
      publication.id,
      publication.content.slug,
    );
    const building = await service.registerVerifiedArtifact(
      publication.id,
      {
        branch,
        commit_sha: commitSha,
        pull_request_number: 54,
        pull_request_url: "https://github.com/oexecutor/P1.Executar.ai/pull/54",
        artifact_paths: editorialArtifactPaths(publication.content.slug),
        created_at: "2026-07-28T14:00:00.000Z",
      },
      "Conector GitHub",
    );
    const verifier = new EditorialConnectorEvidenceVerifier({
      vercel_project_id: "prj_test",
      vercel_hostname_suffix: "-team.vercel.app",
    }, vi.fn(async () => Response.json({
      ok: true,
      data: {
        commit_sha: evidencedSha,
        branch,
        repository: "oexecutor/P1.Executar.ai",
        deployment_url: "editorial-preview-team.vercel.app",
        environment,
        target_environment: environment,
        project_id: "prj_test",
      },
    })) as unknown as typeof fetch);

    await expect(verifier.verifyPreview(building, {
      deployment_id: "dpl_rejected123",
      url: "https://editorial-preview-team.vercel.app",
    })).rejects.toMatchObject({ code: "E2_PREVIEW_EVIDENCE_MISMATCH" });
  });
});

describe("/api/deployment-evidence", () => {
  it("exposes only non-secret Vercel and Git evidence", () => {
    expect(deploymentEvidence({
      VERCEL_GIT_COMMIT_SHA: "e".repeat(40),
      VERCEL_GIT_COMMIT_REF: "editorial/test",
      VERCEL_GIT_REPO_OWNER: "oexecutor",
      VERCEL_GIT_REPO_SLUG: "P1.Executar.ai",
      VERCEL_URL: "preview-team.vercel.app",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
      VERCEL_PROJECT_ID: "prj_test",
      VERCEL_ORG_ID: "team_test",
      EDITORIAL_GITHUB_TOKEN: "must-not-leak",
    })).toEqual({
      commit_sha: "e".repeat(40),
      branch: "editorial/test",
      repository: "oexecutor/P1.Executar.ai",
      deployment_url: "preview-team.vercel.app",
      environment: "preview",
      target_environment: "preview",
      project_id: "prj_test",
      team_id: "team_test",
    });
  });

  it("allows GET and rejects mutation methods", async () => {
    const response = await deploymentEvidenceHandler(
      new Request("https://example.test/api/deployment-evidence", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
