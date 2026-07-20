import type { Store } from "@netlify/blobs";
import { describe, expect, it } from "vitest";
import { DeskWorkflowService } from "../src/lib/desk-workflows.mjs";
import { BlobVaultService } from "../src/lib/vault.mjs";

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

describe("DESK-OS high-ROI workflows", () => {
  it("materializes raw material into an executable project note", async () => {
    const vault = new BlobVaultService(memoryStore());
    const workflows = new DeskWorkflowService(vault);
    const result = await workflows.materialToProject({
      projectId: "H-012",
      projectName: "Copiloto TDAH",
      objective: "Reduzir carga cognitiva.",
      facts: ["Usuário trabalha sozinho."],
      hypotheses: [{ id: "HYP-1", statement: "Três passos reduzem fricção.", confidence: "medium" }],
      evidence: [{ id: "EVD-1", summary: "Teste qualitativo positivo.", strength: "moderate" }],
      gaps: ["Disposição a pagar."],
      deliverables: [{ name: "Painel semanal", acceptanceCriteria: ["Imprimível"] }],
      tasks: [{ title: "Criar protótipo", status: "não iniciada" }],
      nextAction: "Validar o fluxo principal.",
      nextSteps: ["Abrir material", "Estruturar projeto", "Gerar painel"],
    });
    expect(result.path).toBe("DESK-OS/Projects/H-012/00_PROJECT_EXECUTABLE.md");
    const note = await vault.read(String(result.path));
    expect(String(note.content)).toContain("## Próxima ação única");
    expect(String(note.content)).toContain("HYP-1");
  });

  it("creates a daily focus note and requires a revision to overwrite it", async () => {
    const vault = new BlobVaultService(memoryStore());
    const workflows = new DeskWorkflowService(vault);
    const created = await workflows.dailyNextAction({
      date: "2026-07-18",
      projectId: "H-012",
      captures: [{ text: "Revisar protótipo", classification: "next_action", priority: "high" }],
      blockers: ["Sem feedback externo"],
      nextAction: "Enviar protótipo.",
      steps: ["Revisar", "Exportar", "Enviar"],
    });
    await expect(workflows.dailyNextAction({
      date: "2026-07-18",
      nextAction: "Outro foco.",
      steps: ["A", "B", "C"],
      overwrite: true,
    })).rejects.toMatchObject({ code: "REVISION_REQUIRED" });
    const updated = await workflows.dailyNextAction({
      date: "2026-07-18",
      nextAction: "Outro foco.",
      steps: ["A", "B", "C"],
      overwrite: true,
      expectedSha256: String(created.sha256),
    });
    expect(updated.updated).toBe(true);
  });

  it("records evidence, a multisystem dashboard, and a paper capture", async () => {
    const vault = new BlobVaultService(memoryStore());
    const workflows = new DeskWorkflowService(vault);
    const evidence = await workflows.evidenceToDecision({
      evidenceId: "EV-001",
      title: "Teste com usuário",
      source: "Entrevista",
      evidenceType: "qualitative",
      summary: "O usuário iniciou com menos esforço.",
      hypothesisId: "HYP-1",
      hypothesisStatement: "Três passos reduzem fricção.",
      relation: "supports",
      strength: "moderate",
      decisionProposal: "Manter três passos.",
      rationale: "O comportamento observado foi consistente.",
      planChanges: ["Manter limite de três passos."],
    });
    expect(evidence.path).toBe("DESK-OS/Evidence/EV-001.md");

    const dashboard = await workflows.multisystemDashboard({
      systems: [{ system: "Obsidian", collectedAt: "2026-07-18T20:00:00-03:00", status: "ok", summary: "Vault disponível.", openItems: 3 }],
      singleNextAction: "Revisar as três notas abertas.",
    });
    expect(dashboard.systems).toBe(1);

    const capture = await workflows.paperToDigital({
      captureId: "CAP-001",
      projectId: "H-012",
      weekId: "W29",
      action: "close_day",
      transcription: "Concluí o primeiro passo.",
      confirmedText: "Concluí o primeiro passo.",
      confidence: 0.95,
      completedTasks: ["Primeiro passo"],
    });
    expect(capture.needsReview).toBe(false);
    expect(String((await vault.read(String(capture.path))).content)).toContain("Tarefas concluídas");
  });
});
