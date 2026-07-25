import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorialHandler, setEditorialServiceForTesting } from "../api/editorial.js";
import { EditorialService } from "../src/editorial/service.js";
import { EditorialStore } from "../src/editorial/store.js";
import { adminCookie, appCookie, signAdminSession, signAppSession } from "../src/lib/auth.js";
import { memoryStore } from "./helpers/memory-store.js";

const sourceText = `# Automação editorial com QR semântico

## Contexto

A EXECUTA.AI Blog Integration V2 transforma um briefing editorial em um artigo versionado, validado e revisado antes de qualquer publicação. O fluxo preserva aprovação humana explícita e registra a evidência do commit utilizado.

## Operação

O artigo segue para branch, pull request e Vercel Preview. Depois da revisão, o commit aprovado pode ser publicado no EXECUTA Journal e conectado a um router de QR estável.`;

function service() {
  return new EditorialService(new EditorialStore(memoryStore()));
}

function briefing() {
  return {
    title: "Automação editorial com QR semântico",
    summary: "Vertical slice da EXECUTA.AI Blog Integration V2.",
    audience: "Solo entrepreneurs e equipes editoriais",
    objective: "Publicar artigos com validação, preview e aprovação humana.",
    author: "Leonardo",
    source_text: sourceText,
    keywords: ["automação editorial", "QR semântico"],
  };
}

describe("EditorialPublication domain", () => {
  it("creates a publication without confusing it with the 3–9–36 project model", async () => {
    const editorial = service();
    const publication = await editorial.createPublication(briefing());

    expect(publication.id).toMatch(/^PUB-/);
    expect(publication.status).toBe("DRAFT");
    expect(publication.briefing.channel).toBe("EXECUTA_JOURNAL");
    expect(publication).not.toHaveProperty("phases");
    expect(publication.events[0]?.type).toBe("CREATED");
  });

  it("runs the guarded preview, review and publication lifecycle", async () => {
    const editorial = service();
    const created = await editorial.createPublication(briefing());
    const id = created.id;

    const validated = await editorial.runQualityGate(id, "Leonardo");
    expect(validated.status).toBe("READY_FOR_PREVIEW");
    expect(validated.quality.valid).toBe(true);

    await editorial.startPreview(id, {
      branch: `editorial/${created.content.slug}`,
      commit_sha: "a".repeat(40),
      pull_request_number: 99,
      pull_request_url: "https://github.com/oexecutor/Executar.ai/pull/99",
      actor: "GitHub automation",
    });
    const preview = await editorial.attachPreview(id, {
      url: "https://executar-preview.vercel.app/blog/automacao-editorial-com-qr-semantico",
      deployment_id: "dpl_test",
      actor: "Vercel",
    });
    expect(preview.status).toBe("PREVIEW_READY");

    await editorial.startReview(id, "Leonardo");
    await expect(editorial.startPublishing(id, "Leonardo")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    const approved = await editorial.review(id, {
      decision: "APPROVED",
      reviewer: "Leonardo",
      note: "Preview aprovado.",
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.approval.approved_commit_sha).toBe("a".repeat(40));

    await editorial.startPublishing(id, "Leonardo");
    const published = await editorial.markPublished(id, {
      url: "https://executar-ai.vercel.app/blog/automacao-editorial-com-qr-semantico",
      commit_sha: "a".repeat(40),
      actor: "Vercel",
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publication.url).toContain("/blog/");
  });

  it("invalidates approval and preview evidence when content changes", async () => {
    const editorial = service();
    const created = await editorial.createPublication(briefing());
    const updated = await editorial.updateContent(created.id, {
      markdown: `${sourceText}\n\n## Evidência\n\nNova versão do conteúdo.`,
      actor: "Leonardo",
    });

    expect(updated.version).toBe(2);
    expect(updated.status).toBe("DRAFT");
    expect(updated.github.commit_sha).toBeNull();
    expect(updated.preview.url).toBeNull();
    expect(updated.approval.decision).toBe("PENDING");
  });
});

describe("/api/editorial", () => {
  let cookie = "";
  let editorial: EditorialService;

  beforeEach(async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
    vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
    editorial = service();
    setEditorialServiceForTesting(() => editorial);
    cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
  });

  afterEach(() => {
    setEditorialServiceForTesting(null);
    vi.unstubAllEnvs();
  });

  async function call(method: string, path: string, body?: unknown) {
    return editorialHandler(new Request(`https://example.test/api/editorial${path}`, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
  }

  it("fails closed without authentication in tests", async () => {
    const response = await editorialHandler(new Request("https://example.test/api/editorial/publications"));
    expect(response.status).toBe(401);
  });

  it("allows viewers to list and rejects editorial mutations", async () => {
    cookie = appCookie(await signAppSession({
      userId: "usr_viewer",
      email: "viewer@example.test",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      role: "VIEWER",
    })).split(";")[0] ?? "";

    expect((await call("GET", "/publications")).status).toBe(200);
    const denied = await call("POST", "/publications", briefing());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("creates, validates and exports the same editorial publication", async () => {
    const createdResponse = await call("POST", "/publications", briefing());
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { data: { id: string } };

    const validationResponse = await call("POST", `/publications/${created.data.id}/validate`, { actor: "Leonardo" });
    expect(validationResponse.status).toBe(200);
    expect(await validationResponse.json()).toMatchObject({ data: { status: "READY_FOR_PREVIEW" } });

    const list = await (await call("GET", "/publications")).json() as { data: Array<{ id: string }> };
    expect(list.data.map((publication) => publication.id)).toContain(created.data.id);

    const exported = await (await call("GET", `/publications/${created.data.id}/export`)).json() as { data: { briefing: { title: string } } };
    expect(exported.data.briefing.title).toBe(briefing().title);
  });
});
