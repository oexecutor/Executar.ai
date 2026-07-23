import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BlobVaultService, MAX_BINARY_IMPORT_BYTES, VaultProblem } from "./lib/vault.js";
import { DeskWorkflowService } from "./lib/desk-workflows.js";
import { DeskOsService } from "./application/desk-os-service.js";
import { registerDeskOsTools } from "./mcp/desk-os-tools.js";
import { WorkflowDashboardService } from "./lib/workflow-dashboard.js";
import { buildVaultBrowserUrl, buildVaultViewUrl } from "./lib/viewer.js";

const relativePath = z.string().min(1).describe("Vault-relative path using forward slashes. Never use an absolute path.");
const notePath = z.string().endsWith(".md").describe("Vault-relative Markdown path ending in .md.");
const resultOutput = { result: z.object({}).passthrough() };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enrichViewLinks(value: unknown, publicBaseUrl: string): unknown {
  if (Array.isArray(value)) return value.map((item) => enrichViewLinks(item, publicBaseUrl));
  if (!isRecord(value)) return value;

  const enriched: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) enriched[key] = enrichViewLinks(child, publicBaseUrl);

  const pathValue = typeof value.path === "string" ? value.path : undefined;
  const destination = typeof value.destination === "string" ? value.destination : undefined;
  const activePath = pathValue && value.kind !== "folder" && value.trashed !== true
    ? pathValue
    : destination && (value.moved === true || value.copied === true || value.restored === true)
      ? destination
      : undefined;
  if (activePath) enriched.viewUrl = buildVaultViewUrl(publicBaseUrl, activePath);
  return enriched;
}

function collectViewLinks(value: unknown, links = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value)) {
    for (const item of value) collectViewLinks(item, links);
    return links;
  }
  if (!isRecord(value)) return links;
  if (typeof value.viewUrl === "string") {
    const label = typeof value.path === "string" ? value.path : typeof value.destination === "string" ? value.destination : "Abrir arquivo";
    links.set(value.viewUrl, label);
  }
  for (const child of Object.values(value)) collectViewLinks(child, links);
  return links;
}

function markdownLabel(value: string): string {
  return value.replace(/[[\]\n\r]/g, " ").trim();
}

function ok(summary: string, result: unknown, publicBaseUrl?: string) {
  const enrichedResult = publicBaseUrl ? enrichViewLinks(result, publicBaseUrl) : result;
  const browserUrl = publicBaseUrl ? buildVaultBrowserUrl(publicBaseUrl) : undefined;
  const structuredResult = isRecord(enrichedResult) && browserUrl
    ? { ...enrichedResult, vaultBrowserUrl: browserUrl }
    : enrichedResult;
  const links = publicBaseUrl ? [...collectViewLinks(enrichedResult).entries()].slice(0, 50) : [];
  const navigation = publicBaseUrl
    ? `\n\n### Abrir no navegador\n- [Navegar por todos os arquivos](${browserUrl})${links.map(([url, label]) => `\n- [${markdownLabel(label)}](${url})`).join("")}`
    : "";
  return {
    content: [{ type: "text" as const, text: `${summary}${navigation}\n\n${JSON.stringify(structuredResult, null, 2)}` }],
    structuredContent: { result: structuredResult },
  };
}

function failed(error: unknown) {
  const payload = error instanceof VaultProblem
    ? { code: error.code, message: error.message, suggestion: error.suggestion }
    : { code: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error), suggestion: "Inspect the server logs and retry." };
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: payload }, null, 2) }] };
}

function guarded<T extends Record<string, unknown>>(summary: string, action: (input: T) => Promise<unknown>, publicBaseUrl?: string) {
  return async (input: T) => {
    try { return ok(summary, await action(input), publicBaseUrl); }
    catch (error) { return failed(error); }
  };
}

export function createMcpServer(
  vault: BlobVaultService,
  options: { publicBaseUrl?: string; deskOsService?: DeskOsService; actorId?: string } = {},
): McpServer {
  const server = new McpServer({ name: "desk-os-obsidian-cloud", version: "1.7.0" });
  const workflows = new DeskWorkflowService(vault);
  const workflowDashboards = new WorkflowDashboardService(vault, options.publicBaseUrl);
  const handle = <T extends Record<string, unknown>>(summary: string, action: (input: T) => Promise<unknown>) => guarded(summary, action, options.publicBaseUrl);

  server.registerTool("obsidian_vault_info", {
    title: "Inspect cloud Obsidian vault",
    description: "Verify the connected DESK-OS cloud vault and return note, file, folder, and storage counts.",
    inputSchema: {}, outputSchema: resultOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("Vault inspected.", async () => vault.info()));

  server.registerTool("obsidian_list_entries", {
    title: "List vault entries",
    description: "Browse notes, files, and virtual folders with filtering and pagination.",
    inputSchema: {
      folder: z.string().optional().default(""), recursive: z.boolean().optional().default(false),
      kind: z.enum(["all", "file", "folder", "note"]).optional().default("all"),
      cursor: z.number().int().min(0).optional().default(0), limit: z.number().int().min(1).max(200).optional().default(50),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("Vault entries listed.", async (input) => vault.list(input)));

  server.registerTool("obsidian_read_note", {
    title: "Read note or text file",
    description: "Read text content, YAML frontmatter, metadata, and the SHA-256 revision token used for safe updates.",
    inputSchema: { path: relativePath }, outputSchema: resultOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("File read.", async ({ path }) => vault.read(path as string)));

  server.registerTool("obsidian_search_notes", {
    title: "Search Obsidian notes",
    description: "Search Markdown note contents using literal text or a regular expression.",
    inputSchema: {
      query: z.string().min(1), folder: z.string().optional().default(""), caseSensitive: z.boolean().optional().default(false),
      regex: z.boolean().optional().default(false), limit: z.number().int().min(1).max(100).optional().default(25),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("Search completed.", async (input) => vault.search(input)));

  server.registerTool("obsidian_create_note", {
    title: "Create Obsidian note",
    description: "Create a Markdown note without overwriting an existing path.",
    inputSchema: { path: notePath, content: z.string(), frontmatter: z.record(z.unknown()).optional() }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, handle("Note created.", async (input) => vault.createNote(input)));

  server.registerTool("obsidian_import_binary", {
    title: "Import binary file into the vault",
    description: `Store an exact binary attachment in the remote Obsidian vault from base64 bytes. Use for ZIP skill packages, PDFs, images, archives, and other non-text files. Maximum decoded size is ${MAX_BINARY_IMPORT_BYTES} bytes. Do not invent base64 from a textual summary; call this only when the client exposes the original file bytes.`,
    inputSchema: {
      path: relativePath.describe("Destination including filename and extension, for example 98_MODELOS/Skills/my-skill.zip."),
      dataBase64: z.string().min(1).max(5_600_000).describe("Exact file bytes encoded as standard or URL-safe base64. A data:...;base64,... URL is also accepted."),
      mimeType: z.string().max(200).optional().describe("Optional MIME type such as application/zip."),
      originalName: z.string().min(1).max(255).optional().describe("Original filename for provenance metadata."),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional().describe("Required when overwrite=true and the destination already exists."),
      expectedContentSha256: z.string().regex(/^[a-f0-9]{64}$/).optional().describe("Optional checksum of the incoming bytes for end-to-end integrity verification."),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Binary file imported.", async (input) => vault.importBinary(input)));

  server.registerTool("obsidian_update_note", {
    title: "Update Obsidian note",
    description: "Replace, append, or prepend Markdown. Pass expectedSha256 from a prior read to prevent lost updates.",
    inputSchema: {
      path: notePath, content: z.string(), mode: z.enum(["replace", "append", "prepend"]).optional().default("replace"),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Note updated.", async (input) => vault.updateNote(input)));

  server.registerTool("obsidian_update_frontmatter", {
    title: "Update note properties",
    description: "Set or remove YAML frontmatter properties without rewriting the note body.",
    inputSchema: {
      path: notePath, set: z.record(z.unknown()).optional(), remove: z.array(z.string().min(1)).optional(),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("Frontmatter updated.", async (input) => vault.updateFrontmatter(input)));

  server.registerTool("obsidian_move_entry", {
    title: "Move or rename vault entry",
    description: "Move or rename one file. An explicit overwrite first moves the displaced destination to recoverable trash.",
    inputSchema: { source: relativePath, destination: relativePath, overwrite: z.boolean().optional().default(false) }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Entry moved.", async (input) => vault.move(input)));

  server.registerTool("obsidian_copy_entry", {
    title: "Copy vault entry",
    description: "Copy one file. An explicit overwrite first moves the displaced destination to recoverable trash.",
    inputSchema: { source: relativePath, destination: relativePath, overwrite: z.boolean().optional().default(false) }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, handle("Entry copied.", async (input) => vault.copy(input)));

  server.registerTool("obsidian_trash_entry", {
    title: "Move entry to recoverable trash",
    description: "Remove one file from active content by moving it to recoverable cloud trash. Permanent deletion is not exposed.",
    inputSchema: { path: relativePath }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Entry moved to recoverable trash.", async ({ path }) => vault.trash(path as string)));

  server.registerTool("obsidian_list_trash", {
    title: "List recoverable trash",
    description: "List recoverable trash records without exposing their contents.",
    inputSchema: {}, outputSchema: resultOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handle("Recoverable trash listed.", async () => vault.listTrash()));

  server.registerTool("obsidian_restore_trash", {
    title: "Restore trashed entry",
    description: "Restore a trash record to its original path or a different destination.",
    inputSchema: { trashId: z.string().min(1), destination: z.string().optional(), overwrite: z.boolean().optional().default(false) }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, handle("Entry restored.", async (input) => vault.restoreTrash(input)));


  server.registerTool("desk_material_to_project", {
    title: "Material bruto para projeto executável",
    description: "Materialize a análise já realizada pelo modelo em uma nota de projeto DESK-OS com fatos, hipóteses, evidências, lacunas, entregas, tarefas, uma próxima ação e exatamente três passos. The host model performs semantic analysis; this tool validates and persists the structured result in the vault.",
    inputSchema: {
      projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      projectName: z.string().min(1).max(200),
      objective: z.string().min(1).max(5000),
      sourceSummary: z.string().max(10000).optional(),
      sourcePaths: z.array(relativePath).max(100).optional(),
      facts: z.array(z.string().min(1).max(2000)).max(100).optional(),
      hypotheses: z.array(z.object({ id: z.string().max(80).optional(), statement: z.string().min(1).max(3000), confidence: z.enum(["low", "medium", "high"]).optional(), status: z.string().max(120).optional() })).max(100).optional(),
      evidence: z.array(z.object({ id: z.string().max(80).optional(), summary: z.string().min(1).max(3000), source: z.string().max(1000).optional(), strength: z.enum(["weak", "moderate", "strong"]).optional() })).max(100).optional(),
      gaps: z.array(z.string().min(1).max(2000)).max(100).optional(),
      deliverables: z.array(z.object({ name: z.string().min(1).max(300), outcome: z.string().max(3000).optional(), acceptanceCriteria: z.array(z.string().min(1).max(1000)).max(30).optional() })).max(100).optional(),
      tasks: z.array(z.object({ title: z.string().min(1).max(500), deliverable: z.string().max(300).optional(), owner: z.string().max(200).optional(), dueDate: z.string().max(50).optional(), status: z.string().max(120).optional() })).max(100).optional(),
      nextAction: z.string().min(1).max(1000),
      nextSteps: z.array(z.string().min(1).max(1000)).length(3),
      outputRoot: z.string().optional().default("DESK-OS/Projects"),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Projeto executável materializado.", async (input) => workflows.materialToProject(input)));

  server.registerTool("desk_daily_next_action", {
    title: "Captura diária para próxima ação única",
    description: "Consolide capturas já classificadas pelo modelo em um painel diário DESK-OS com bloqueios, uma próxima ação e exatamente três passos executáveis.",
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/).optional(),
      captures: z.array(z.object({ text: z.string().min(1).max(2000), project: z.string().max(200).optional(), source: z.string().max(300).optional(), classification: z.enum(["next_action", "waiting", "reference", "discard"]), priority: z.enum(["low", "medium", "high"]).optional() })).max(100).optional(),
      blockers: z.array(z.string().min(1).max(2000)).max(100).optional(),
      nextAction: z.string().min(1).max(1000),
      steps: z.array(z.string().min(1).max(1000)).length(3),
      commitment: z.string().max(1000).optional(),
      outputRoot: z.string().optional().default("DESK-OS/Daily"),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Painel diário materializado.", async (input) => workflows.dailyNextAction(input)));

  server.registerTool("desk_evidence_to_decision", {
    title: "Evidência para decisão e alteração do plano",
    description: "Registre uma evidência, sua relação com uma hipótese, força, contraevidências, decisão proposta e alterações previstas no plano. This tool records governance data; approval remains explicit in decisionStatus.",
    inputSchema: {
      evidenceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      title: z.string().min(1).max(300),
      projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/).optional(),
      observedAt: z.string().datetime({ offset: true }).optional(),
      source: z.string().min(1).max(2000),
      evidenceType: z.enum(["qualitative", "quantitative", "documentary", "operational"]),
      summary: z.string().min(1).max(10000),
      hypothesisId: z.string().min(1).max(100),
      hypothesisStatement: z.string().min(1).max(5000),
      relation: z.enum(["supports", "contradicts", "neutral"]),
      strength: z.enum(["weak", "moderate", "strong"]),
      counterEvidence: z.array(z.string().min(1).max(3000)).max(100).optional(),
      decisionProposal: z.string().min(1).max(5000),
      decisionStatus: z.enum(["proposed", "approved", "rejected", "paused"]).optional().default("proposed"),
      rationale: z.string().min(1).max(5000),
      planChanges: z.array(z.string().min(1).max(3000)).max(100).optional(),
      outputRoot: z.string().optional().default("DESK-OS/Evidence"),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Evidência e decisão registradas.", async (input) => workflows.evidenceToDecision(input)));

  server.registerTool("desk_multisystem_dashboard", {
    title: "Estado multissistema para painel único",
    description: "Persista um painel DESK-OS a partir de snapshots já coletados de Linear, GitHub, Obsidian, Drive ou outros sistemas. The MCP host must gather each snapshot first; this tool detects no external state by itself.",
    inputSchema: {
      title: z.string().max(300).optional(),
      generatedAt: z.string().datetime({ offset: true }).optional(),
      systems: z.array(z.object({ system: z.string().min(1).max(200), collectedAt: z.string().datetime({ offset: true }), status: z.enum(["ok", "warning", "blocked", "unknown"]), summary: z.string().min(1).max(5000), changes: z.array(z.string().min(1).max(2000)).max(100).optional(), openItems: z.number().int().min(0).optional(), url: z.string().url().optional() })).min(1).max(100),
      divergences: z.array(z.object({ topic: z.string().min(1).max(500), systems: z.array(z.string().min(1).max(200)).min(2).max(20), description: z.string().min(1).max(3000), severity: z.enum(["low", "medium", "high"]) })).max(100).optional(),
      risks: z.array(z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(1000), level: z.enum(["low", "medium", "high"]), mitigation: z.string().max(3000).optional() })).max(100).optional(),
      blockers: z.array(z.string().min(1).max(3000)).max(100).optional(),
      nextActions: z.array(z.object({ title: z.string().min(1).max(1000), owner: z.string().max(200).optional(), dueDate: z.string().max(50).optional(), source: z.string().max(200).optional() })).max(100).optional(),
      singleNextAction: z.string().min(1).max(1000),
      outputPath: notePath.optional().default("DESK-OS/Dashboards/CURRENT_STATUS.md"),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Painel multissistema materializado.", async (input) => workflows.multisystemDashboard(input)));

  server.registerTool("desk_ingest_workflow_dashboard", {
    title: "Ingerir workflow e atualizar dashboard dinâmico",
    description: "Persist normalized workflow state and regenerate a living HTML status dashboard inside the vault. Call after research, discovery, product, business, design, code, governance, or validation workflows. Supports replace for a full snapshot and upsert for incremental updates by stable IDs. The tool writes WORKFLOW_STATUS.json, STATUS_DASHBOARD.html, DASHBOARD.md, and an audit snapshot.",
    inputSchema: {
      workflowId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      title: z.string().min(1).max(300),
      subtitle: z.string().max(1000).optional(),
      sourceDocument: z.string().max(600).optional(),
      documentVersion: z.string().max(100).optional(),
      observedAt: z.string().datetime({ offset: true }).optional(),
      mode: z.enum(["replace", "upsert"]).optional().default("upsert"),
      gate: z.object({
        decision: z.enum(["AVANÇAR", "CORRIGIR", "PAUSAR", "ENCERRAR"]),
        summary: z.string().min(1).max(3000),
        exitCondition: z.string().max(2000).optional(),
      }),
      sources: z.array(z.object({
        id: z.string().min(1).max(100), title: z.string().max(500).optional(), path: z.string().max(600).optional(),
        kind: z.string().max(100).optional(), status: z.string().max(100).optional(),
      })).max(100).optional(),
      areas: z.array(z.object({
        id: z.string().min(1).max(100), label: z.string().min(1).max(300), score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
        note: z.string().max(2000).optional(),
      })).max(100).optional(),
      decisions: z.array(z.object({
        id: z.string().min(1).max(100), title: z.string().min(1).max(2000),
        status: z.enum(["proposed", "approved", "rejected", "paused"]), caveat: z.string().max(2000).optional(),
      })).max(100).optional(),
      gaps: z.array(z.object({
        id: z.string().min(1).max(100), title: z.string().min(1).max(2000), impact: z.string().min(1).max(2000),
        priority: z.enum(["low", "medium", "high", "critical"]), status: z.enum(["open", "resolved", "paused"]),
        owner: z.string().max(300).optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })).max(100).optional(),
      counterEvidence: z.array(z.object({
        id: z.string().min(1).max(100), title: z.string().min(1).max(2000), impact: z.string().max(2000).optional(),
        status: z.enum(["open", "resolved", "paused"]),
      })).max(100).optional(),
      risks: z.array(z.object({
        id: z.string().min(1).max(100), title: z.string().min(1).max(2000), level: z.enum(["low", "medium", "high", "critical"]),
        status: z.enum(["open", "mitigated", "closed"]), mitigation: z.string().max(2000).optional(),
      })).max(100).optional(),
      nextAction: z.string().max(2000).optional(),
      ingestionSummary: z.string().max(5000).optional(),
      sourcePaths: z.array(relativePath).max(100).optional(),
      remove: z.object({
        sourceIds: z.array(z.string().min(1).max(100)).max(100).optional(), areaIds: z.array(z.string().min(1).max(100)).max(100).optional(),
        decisionIds: z.array(z.string().min(1).max(100)).max(100).optional(), gapIds: z.array(z.string().min(1).max(100)).max(100).optional(),
        counterEvidenceIds: z.array(z.string().min(1).max(100)).max(100).optional(), riskIds: z.array(z.string().min(1).max(100)).max(100).optional(),
      }).optional(),
      outputRoot: z.string().max(500).optional(),
      expectedStateSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      writeHistory: z.boolean().optional().default(true),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, handle("Workflow ingested and dashboard regenerated.", async (input) => workflowDashboards.ingest(input)));

  server.registerTool("desk_paper_to_digital", {
    title: "Papel preenchido para estado digital",
    description: "Registre uma captura físico-digital identificada por contexto de QR, com transcrição, confirmação, confiança, atualizações de estado, tarefas e próxima ação. Raw QR secrets are intentionally not accepted.",
    inputSchema: {
      captureId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      weekId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      action: z.enum(["start", "status", "close_day", "recycle", "other"]),
      capturedAt: z.string().datetime({ offset: true }).optional(),
      userId: z.string().max(200).optional(),
      imageReference: z.string().max(2000).optional(),
      transcription: z.string().min(1).max(20000),
      confirmedText: z.string().max(20000).optional(),
      confidence: z.number().min(0).max(1).optional(),
      needsReview: z.boolean().optional(),
      statusUpdates: z.array(z.object({ field: z.string().min(1).max(300), previous: z.string().max(2000).optional(), next: z.string().min(1).max(2000) })).max(100).optional(),
      completedTasks: z.array(z.string().min(1).max(1000)).max(100).optional(),
      newTasks: z.array(z.object({ title: z.string().min(1).max(1000), steps: z.array(z.string().min(1).max(1000)).max(20).optional() })).max(100).optional(),
      notes: z.array(z.string().min(1).max(3000)).max(100).optional(),
      nextAction: z.string().max(1000).optional(),
      outputRoot: z.string().optional().default("DESK-OS/Paper-Captures"),
      overwrite: z.boolean().optional().default(false),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, handle("Captura físico-digital registrada.", async (input) => workflows.paperToDigital(input)));

  // Gate 4: the desk_os_* PM catalog is ADDITIVE — the 19 obsidian_*/desk_*
  // tools above keep working unchanged for existing MCP clients (DEC-002).
  if (options.deskOsService) {
    registerDeskOsTools(server, options.deskOsService, options.actorId ?? "mcp-client");
  }

  return server;
}
