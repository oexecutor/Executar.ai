import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import executarHandler, { setExecutarServiceForTesting } from "../api/executar.js";
import { adminCookie, appCookie, signAdminSession, signAppSession } from "../src/lib/auth.js";
import { dashboardSummary } from "../src/executar/engine.js";
import { validateProject } from "../src/executar/schema.js";
import { ExecutarService } from "../src/executar/service.js";
import { ExecutarStore } from "../src/executar/store.js";
import { buildCanonicalProject } from "../src/executar/template.js";
import { memoryStore } from "./helpers/memory-store.js";

function service() {
  return new ExecutarService(new ExecutarStore(memoryStore()));
}

describe("canonical EXECUTA 3–9–36 engine", () => {
  it("builds and validates exactly 3 phases, 9 areas and 36 items", () => {
    const project = buildCanonicalProject({ name: "Lançamento", description: "Lançar um PWA." });
    expect(validateProject(project)).toEqual({ valid: true, errors: [] });
    expect(project.phases).toHaveLength(3);
    expect(project.areas).toHaveLength(9);
    expect(project.areas.flatMap((area) => area.items)).toHaveLength(36);
    expect(project.areas.flatMap((area) => area.items).filter((item) => item.type === "task")).toHaveLength(27);
    expect(project.areas.flatMap((area) => area.items).filter((item) => item.type === "checkpoint")).toHaveLength(9);
  });

  it("computes 81 atomic actions and a deterministic current pointer", () => {
    const project = buildCanonicalProject({ name: "Lançamento", description: "Lançar um PWA." });
    const status = dashboardSummary(project, {});
    expect(status.actions).toMatchObject({ total: 81, done: 0, pct: 0 });
    expect(status.current).toMatchObject({ itemId: "T02", itemType: "task" });
  });

  it("gates checkpoints until every predecessor action is done", async () => {
    const executar = service();
    const created = await executar.createProject({ name: "Projeto", description: "Objetivo" });
    const id = created.project.meta.id;
    await expect(executar.completeCheckpoint(id, "T01", true)).rejects.toMatchObject({ code: "CHECKPOINT_GATED" });
    for (const taskId of ["T02", "T03", "T04"]) {
      for (const action of ["1", "2", "3"]) await executar.completeAction(id, `${taskId}.${action}`, true);
    }
    await expect(executar.completeCheckpoint(id, "T01", true)).resolves.toMatchObject({ done: true });
    expect((await executar.getStatus(id)).items.checkpoints.done).toBe(1);
  });

  it("keeps workspaces isolated by their storage adapter", async () => {
    const left = service();
    const right = service();
    await left.createProject({ name: "Somente A", description: "Workspace A" });
    expect(await left.listProjects()).toHaveLength(1);
    expect(await right.listProjects()).toHaveLength(0);
  });
});

describe("/api/executar", () => {
  let cookie = "";
  let executar: ExecutarService;

  beforeEach(async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
    vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
    executar = service();
    setExecutarServiceForTesting(() => executar);
    cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
  });

  afterEach(() => {
    setExecutarServiceForTesting(null);
    vi.unstubAllEnvs();
  });

  async function call(method: string, path: string, body?: unknown) {
    return executarHandler(new Request(`https://example.test/api/executar${path}`, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
  }

  it("fails closed without authentication", async () => {
    const response = await executarHandler(new Request("https://example.test/api/executar/projects"));
    expect(response.status).toBe(401);
  });

  it("allows viewers to read and rejects canonical project mutations", async () => {
    cookie = appCookie(await signAppSession({
      userId: "usr_viewer",
      email: "viewer@example.test",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      role: "VIEWER",
    })).split(";")[0] ?? "";
    expect((await call("GET", "/projects")).status).toBe(200);
    const denied = await call("POST", "/projects", { name: "Bloqueado", description: "Somente leitura." });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("creates, lists, reads and advances the same canonical project", async () => {
    const createdResponse = await call("POST", "/projects", { name: "Novo SaaS", description: "Lançar o produto." });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { data: { project: { meta: { id: string } } } };
    const id = created.data.project.meta.id;

    const list = await (await call("GET", "/projects")).json() as { data: Array<{ id: string }> };
    expect(list.data.map((project) => project.id)).toContain(id);

    expect((await call("POST", `/projects/${id}/actions/T02.1`, { done: true })).status).toBe(200);
    const status = await (await call("GET", `/projects/${id}/status`)).json() as { data: { actions: { done: number } } };
    expect(status.data.actions.done).toBe(1);

    const exported = await (await call("GET", `/projects/${id}/export`)).json() as { data: { progress: Record<string, boolean> } };
    expect(exported.data.progress["T02.1"]).toBe(true);
  });
});
