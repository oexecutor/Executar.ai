import type { KvStore as Store } from "../src/lib/kv-store.mjs";
import { describe, expect, it } from "vitest";
import { BlobVaultService } from "../src/lib/vault.mjs";
import { WorkflowDashboardService, isGeneratedWorkflowDashboard } from "../src/lib/workflow-dashboard.mjs";

function memoryStore(): Store {
  const values = new Map<string, unknown>();
  return {
    async set(key: string, value: unknown) { values.set(key, value); },
    async setJSON(key: string, value: unknown) { values.set(key, structuredClone(value)); },
    async get(key: string) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async getWithMetadata() { return null; },
    async getMetadata() { return null; },
    async list(options?: { prefix?: string }) {
      return { blobs: [...values.keys()].filter((key) => !options?.prefix || key.startsWith(options.prefix)).map((key) => ({ key, etag: "test" })), directories: [] };
    },
    async delete(key: string) { values.delete(key); },
  } as unknown as Store;
}

const initial = {
  workflowId: "WORKOS-CONSULTORIA",
  title: "WorkOS Neuroadaptado — Consultoria",
  subtitle: "Status vivo do workflow",
  sourceDocument: "executar-app-ecossistema/06_CONSULTORIA_E_SERVICOS/00_PRODUCT_SOURCE_OF_TRUTH.md",
  documentVersion: "0.1.0",
  observedAt: "2026-07-19T12:00:00-03:00",
  mode: "replace" as const,
  gate: {
    decision: "PAUSAR" as const,
    summary: "Validação interna concluída, mas nenhum cliente externo validou o sistema.",
    exitCondition: "Concluir um piloto externo.",
  },
  sources: Array.from({ length: 7 }, (_, index) => ({ id: `SRC-${String(index + 1).padStart(3, "0")}`, title: `Fonte ${index + 1}` })),
  areas: [
    { id: "01", label: "Governança", score: 0 as const },
    { id: "06", label: "Consultoria", score: 2 as const },
  ],
  decisions: [{ id: "DEC-001", title: "Produtizar o fluxo", status: "approved" as const, caveat: "Validação externa pendente" }],
  gaps: [
    { id: "GAP-010", title: "Capacidade de pagamento", impact: "Impede definir preço", priority: "high" as const, status: "open" as const },
    { id: "GAP-011", title: "Canal de aquisição", impact: "Impede vender", priority: "high" as const, status: "open" as const },
  ],
  counterEvidence: [{ id: "CEV-001", title: "Validação apenas pelo fundador", status: "open" as const }],
  risks: [{ id: "RISK-001", title: "Ausência de demanda externa", level: "high" as const, status: "open" as const }],
  nextAction: "Executar um piloto externo.",
  sourcePaths: ["06_CONSULTORIA_E_SERVICOS/00_PRODUCT_SOURCE_OF_TRUTH.md"],
};

describe("workflow dashboard integration", () => {
  it("persists structured state, HTML dashboard, index, and audit history", async () => {
    const vault = new BlobVaultService(memoryStore());
    const service = new WorkflowDashboardService(vault, "https://desk.example");
    const result = await service.ingest(initial);

    expect(result.created).toBe(true);
    expect(result.updateSequence).toBe(1);
    expect(result.dashboard).toMatchObject({
      path: "DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/STATUS_DASHBOARD.html",
      dashboardUrl: "https://desk.example/dashboard?path=DESK-OS%2FDashboards%2FWorkflows%2FWORKOS-CONSULTORIA%2FSTATUS_DASHBOARD.html",
    });

    const state = await vault.read("DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/WORKFLOW_STATUS.json");
    const parsed = JSON.parse(String(state.content));
    expect(parsed.sources).toHaveLength(7);
    expect(parsed.gaps).toHaveLength(2);
    expect(parsed.updateSequence).toBe(1);

    const dashboard = await vault.read("DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/STATUS_DASHBOARD.html");
    expect(isGeneratedWorkflowDashboard(String(dashboard.content))).toBe(true);
    expect(String(dashboard.content)).toContain("WorkOS Neuroadaptado — Consultoria");
    expect(String(dashboard.content)).toContain(">7<");
    expect(String(dashboard.content)).toContain("GAP-010");

    const history = await vault.list({ folder: "DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/history", recursive: true, kind: "file" });
    expect(history.total).toBe(1);
  });

  it("upserts stable IDs and removes resolved records", async () => {
    const vault = new BlobVaultService(memoryStore());
    const service = new WorkflowDashboardService(vault);
    const first = await service.ingest(initial);
    const second = await service.ingest({
      ...initial,
      observedAt: "2026-07-20T10:00:00-03:00",
      mode: "upsert",
      gate: { decision: "CORRIGIR", summary: "A oferta precisa ser definida.", exitCondition: "Definir oferta e preço." },
      sources: [{ id: "SRC-008", title: "Entrevista externa" }],
      gaps: [{ id: "GAP-010", title: "Capacidade de pagamento", impact: "Preço ainda incerto", priority: "critical", status: "open" }],
      risks: [{ id: "RISK-002", title: "Canal sem prova", level: "medium", status: "open" }],
      remove: { gapIds: ["GAP-011"], riskIds: ["RISK-001"] },
      expectedStateSha256: String((first.state as { sha256: string }).sha256),
    });

    expect(second.updateSequence).toBe(2);
    const state = JSON.parse(String((await vault.read("DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/WORKFLOW_STATUS.json")).content));
    expect(state.sources.map((item: { id: string }) => item.id)).toContain("SRC-008");
    expect(state.gaps.map((item: { id: string }) => item.id)).toEqual(["GAP-010"]);
    expect(state.risks.map((item: { id: string }) => item.id)).toEqual(["RISK-002"]);
    expect(state.gate.decision).toBe("CORRIGIR");
  });

  it("rejects stale revisions and escapes injected HTML", async () => {
    const vault = new BlobVaultService(memoryStore());
    const service = new WorkflowDashboardService(vault);
    await service.ingest({
      ...initial,
      title: "<script>alert(1)</script>",
      gaps: [{ id: "GAP-X", title: "<img src=x onerror=alert(1)>", impact: "teste", priority: "high", status: "open" }],
    });
    const html = String((await vault.read("DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/STATUS_DASHBOARD.html")).content);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    await expect(service.ingest({ ...initial, mode: "upsert", expectedStateSha256: "0".repeat(64) })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
