import { afterEach, describe, expect, it, vi } from "vitest";
import {
  qrHandler,
  setEditorialQrResolverForTesting,
} from "../api/qr.js";
import {
  editorialHandler,
  setEditorialServiceForTesting,
} from "../api/editorial.js";
import { editorialAdapterRegistry } from "../src/editorial/adapters.js";
import type {
  EditorialArtifactPublisher,
  EditorialPreviewResolver,
} from "../src/editorial/delivery.js";
import {
  EDITORIAL_QR_TOKEN_PATTERN,
  resolveEditorialQrDestination,
  type EditorialQrAccessOutcome,
  type EditorialQrRegistration,
  type EditorialQrRepository,
  type EditorialQrResolverRepository,
  type ResolvedEditorialQr,
} from "../src/editorial/qr.js";
import { EditorialService } from "../src/editorial/service.js";
import { EditorialStore, type EditorialRepository } from "../src/editorial/store.js";
import type { EditorialPublication, EditorialQrAction } from "../src/editorial/types.js";
import { adminCookie, signAdminSession } from "../src/lib/auth.js";
import { memoryStore } from "./helpers/memory-store.js";

const article = `# QR semântico estável

## Contexto

O QR impresso representa uma intenção editorial, não uma URL de fornecedor. A
resolução acontece no servidor e preserva a revisão humana antes de qualquer
ação de aprovação, merge ou publicação.

## Operação

Quatro códigos distintos abrem intake, Preview, revisão autorizada e histórico.
Todos possuem fallback textual e nenhum deles contém dado pessoal ou segredo.`;

class MemoryEditorialQrRegistry
  implements EditorialQrRepository, EditorialQrResolverRepository {
  readonly accesses: Array<{
    token: string;
    outcome: EditorialQrAccessOutcome;
    occurredAt: string;
  }> = [];
  private readonly routes = new Map<string, EditorialQrRegistration>();

  constructor(private readonly publications: EditorialRepository) {}

  async listRoutes(publicationId: string): Promise<EditorialQrRegistration[]> {
    return [...this.routes.values()].filter(
      (route) => route.publication_id === publicationId,
    );
  }

  async saveRoutes(
    publicationId: string,
    routes: EditorialQrRegistration[],
  ): Promise<void> {
    for (const route of routes) {
      const existing = [...this.routes.values()].find(
        (candidate) =>
          candidate.publication_id === publicationId
          && candidate.action === route.action,
      );
      if (!existing) this.routes.set(route.token, structuredClone(route));
    }
  }

  async resolveRoute(token: string): Promise<ResolvedEditorialQr | null> {
    const registration = this.routes.get(token);
    if (!registration) return null;
    const publication = await this.publications.getPublication(
      registration.publication_id,
    );
    return publication
      ? {
          registration: structuredClone(registration),
          publication: structuredClone(publication),
        }
      : null;
  }

  async recordAccess(
    token: string,
    outcome: EditorialQrAccessOutcome,
    occurredAt: string,
  ): Promise<void> {
    this.accesses.push({ token, outcome, occurredAt });
  }

  revoke(action: EditorialQrAction): void {
    const route = [...this.routes.values()].find(
      (candidate) => candidate.action === action,
    );
    if (route) route.status = "REVOKED";
  }
}

function delivery(): {
  publisher: EditorialArtifactPublisher;
  resolver: EditorialPreviewResolver;
} {
  return {
    publisher: {
      async publish({ publication }) {
        return {
          branch: `editorial/${publication.id.toLowerCase()}`,
          commit_sha: "a".repeat(40),
          pull_request_number: 23,
          pull_request_url: "https://github.com/oexecutor/P1.Executar.ai/pull/23",
          artifact_paths: [
            `content/blog/${publication.content.slug}.md`,
            `content/blog/${publication.content.slug}.meta.json`,
            `public/blog/${publication.content.slug}/cover.svg`,
          ],
          created_at: "2026-07-28T12:03:00.000Z",
        };
      },
    },
    resolver: {
      async resolve({ commit_sha }) {
        return {
          state: "READY",
          url: "https://immutable-preview.vercel.app",
          deployment_id: "dpl_qr_test",
          commit_sha,
          created_at: "2026-07-28T12:04:00.000Z",
        };
      },
    },
  };
}

function fixture() {
  const repository = new EditorialStore(memoryStore());
  const registry = new MemoryEditorialQrRegistry(repository);
  const integrations = delivery();
  const service = new EditorialService(
    repository,
    editorialAdapterRegistry,
    integrations.publisher,
    integrations.resolver,
    registry,
  );
  return { repository, registry, service };
}

async function completeE3(
  service: EditorialService,
): Promise<EditorialPublication> {
  const created = await service.createPublication({
    title: "QR semântico estável",
    summary: "Router por intenção para o painel editorial.",
    audience: "Equipe editorial",
    objective: "Preservar o papel quando destinos digitais mudarem.",
    author: "Leonardo Batista",
    source_text: article,
  });
  await service.runAdapters(created.id, "Leonardo Batista");
  await service.runQualityGate(created.id, "Leonardo Batista");
  await service.createArtifact(created.id, "Leonardo Batista");
  await service.syncPreview(created.id, "Leonardo Batista");
  await service.startReview(created.id, "Leonardo Batista");
  await service.review(created.id, {
    decision: "APPROVED",
    reviewer: "Leonardo Batista",
    note: "Commit e Preview conferidos.",
  });
  await service.startPublishing(created.id, "Leonardo Batista");
  return service.markPublished(created.id, {
    url: "https://executar-ai.vercel.app/blog/qr-semantico-estavel",
    commit_sha: "a".repeat(40),
    actor: "Vercel",
  });
}

afterEach(() => {
  setEditorialQrResolverForTesting(null);
  setEditorialServiceForTesting(null);
  vi.unstubAllEnvs();
});

describe("Issue #23 E4 — semantic QR domain", () => {
  it("emits four opaque stable routes only after E3 and remains idempotent", async () => {
    const { registry, service } = fixture();
    const draft = await service.createPublication({
      title: "QR ainda bloqueado",
      summary: "Comprova o gate da E4.",
      audience: "Equipe editorial",
      objective: "Não emitir antes da publicação.",
      author: "Leonardo",
      source_text: article,
    });
    await expect(service.issueQrCodes(draft.id, {
      actor: "Leonardo",
      public_base_url: "https://executar.test",
    })).rejects.toMatchObject({ code: "QR_PUBLICATION_REQUIRED" });

    const published = await completeE3(service);
    const issued = await service.issueQrCodes(published.id, {
      actor: "Leonardo Batista",
      public_base_url: "https://executar.test",
    });
    const routes = Object.values(issued.qr.routes);
    expect(routes).toHaveLength(4);
    expect(routes.every(Boolean)).toBe(true);
    const tokens = routes.map((route) => route?.token ?? "");
    expect(new Set(tokens).size).toBe(4);
    expect(tokens.every((token) => EDITORIAL_QR_TOKEN_PATTERN.test(token))).toBe(true);
    expect(routes.map((route) => route?.url)).toEqual(
      tokens.map((token) => `https://executar.test/q/${token}`),
    );
    expect(JSON.stringify(routes)).not.toContain(published.preview.url);
    expect(JSON.stringify(routes)).not.toContain(published.id);
    expect((await registry.listRoutes(published.id))[0]).not.toHaveProperty("destination");

    const repeated = await service.issueQrCodes(published.id, {
      actor: "Leonardo Batista",
      public_base_url: "https://executar.test",
    });
    expect(
      Object.values(repeated.qr.routes).map((route) => route?.token),
    ).toEqual(tokens);
    expect(
      repeated.events.filter((entry) => entry.type === "QR_ISSUED"),
    ).toHaveLength(1);
  });

  it("changes the resolved Preview without changing the printed token and fails safe when absent", async () => {
    const { registry, service } = fixture();
    const published = await completeE3(service);
    const issued = await service.issueQrCodes(published.id, {
      actor: "Leonardo",
      public_base_url: "https://executar.test",
    });
    const previewToken = issued.qr.routes.PREVIEW?.token ?? "";
    const resolved = await registry.resolveRoute(previewToken);
    expect(resolved).not.toBeNull();

    const first = resolveEditorialQrDestination(
      "https://executar.test",
      resolved as ResolvedEditorialQr,
    );
    expect(first).toEqual({
      url: "https://immutable-preview.vercel.app/",
      outcome: "REDIRECTED",
    });

    const changed = structuredClone(resolved) as ResolvedEditorialQr;
    changed.publication.preview.url = "https://new-provider.example/preview";
    const second = resolveEditorialQrDestination(
      "https://executar.test",
      changed,
    );
    expect(second.url).toBe("https://new-provider.example/preview");
    expect(changed.registration.token).toBe(previewToken);

    changed.publication.preview.url = null;
    changed.publication.preview.commit_sha = null;
    const fallback = resolveEditorialQrDestination(
      "https://executar.test",
      changed,
    );
    expect(fallback.outcome).toBe("SAFE_FALLBACK");
    expect(fallback.url).toContain("intent=preview-unavailable");
    expect(fallback.url).not.toContain("undefined");
  });
});

describe("GET /q/:token", () => {
  it("renders a real SVG and redirects by semantic intent with privacy-minimal audit", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://executar.test");
    const { registry, service } = fixture();
    const published = await completeE3(service);
    const issued = await service.issueQrCodes(published.id, {
      actor: "Leonardo",
      public_base_url: "https://executar.test",
    });
    setEditorialQrResolverForTesting(() => registry);

    const preview = issued.qr.routes.PREVIEW;
    expect(preview).not.toBeNull();
    const image = await qrHandler(
      new Request(`https://executar.test/q/${preview?.token}.svg`),
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/svg+xml");
    expect(await image.text()).toMatch(/<svg[^>]+viewBox=/);
    expect(registry.accesses).toHaveLength(0);

    const redirect = await qrHandler(
      new Request(`https://executar.test/q/${preview?.token}`),
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe(
      "https://immutable-preview.vercel.app/",
    );
    expect(registry.accesses).toEqual([
      expect.objectContaining({
        token: preview?.token,
        outcome: "REDIRECTED",
      }),
    ]);
    expect(registry.accesses[0]).toEqual({
      token: preview?.token,
      outcome: "REDIRECTED",
      occurredAt: expect.any(String),
    });

    const approve = issued.qr.routes.APPROVE;
    const approvalRedirect = await qrHandler(
      new Request(`https://executar.test/q/${approve?.token}`),
    );
    expect(approvalRedirect.headers.get("location")).toContain(
      "/app/?tab=editorial",
    );
    expect(approvalRedirect.headers.get("location")).toContain("intent=approve");
    expect((await service.getPublication(published.id)).status).toBe("PUBLISHED");
  });

  it("returns generic 404 and 410 fallbacks without leaking route data", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://executar.test");
    const { registry, service } = fixture();
    const published = await completeE3(service);
    const issued = await service.issueQrCodes(published.id, {
      actor: "Leonardo",
      public_base_url: "https://executar.test",
    });
    setEditorialQrResolverForTesting(() => registry);

    const missing = await qrHandler(
      new Request("https://executar.test/q/qr_AAAAAAAAAAAAAAAAAAAAAAAA"),
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain(published.id);

    registry.revoke("ANALYTICS");
    const revoked = await qrHandler(
      new Request(
        `https://executar.test/q/${issued.qr.routes.ANALYTICS?.token}`,
      ),
    );
    expect(revoked.status).toBe(410);
    expect(await revoked.text()).not.toContain(published.id);
    expect(registry.accesses.at(-1)?.outcome).toBe("REVOKED");
  });
});

describe("POST /api/editorial/publications/:id/qr", () => {
  it("requires explicit confirmation and returns server-issued evidence", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://executar.test");
    vi.stubEnv(
      "MCP_JWT_SECRET",
      "unit-test-secret-with-at-least-32-characters!!",
    );
    const { service } = fixture();
    const published = await completeE3(service);
    setEditorialServiceForTesting(() => service);
    const cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
    const call = (confirm: boolean) => editorialHandler(new Request(
      `https://executar.test/api/editorial/publications/${published.id}/qr`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm }),
      },
    ));

    const denied = await call(false);
    expect(denied.status).toBe(422);
    expect(await denied.json()).toMatchObject({
      error: { code: "CONFIRMATION_REQUIRED" },
    });

    const issued = await call(true);
    expect(issued.status).toBe(200);
    expect(await issued.json()).toMatchObject({
      data: {
        status: "PUBLISHED",
        qr: {
          issued_at: expect.any(String),
          routes: {
            CREATE: { action: "CREATE", status: "ACTIVE" },
            PREVIEW: { action: "PREVIEW", status: "ACTIVE" },
            APPROVE: { action: "APPROVE", status: "ACTIVE" },
            ANALYTICS: { action: "ANALYTICS", status: "ACTIVE" },
          },
        },
      },
    });
  });
});
