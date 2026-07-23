import path from "node:path";
import { stringify } from "yaml";
import { BlobVaultService, VaultProblem } from "./vault.js";

const DEFAULT_ROOT = "DESK-OS";
const MAX_LIST_ITEMS = 100;

export type ClassifiedCapture = {
  text: string;
  project?: string;
  source?: string;
  classification: "next_action" | "waiting" | "reference" | "discard";
  priority?: "low" | "medium" | "high";
};

function safeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(normalized)) {
    throw new VaultProblem("INVALID_INPUT", `${label} must use only letters, numbers, hyphens, and underscores.`, `Use a stable identifier such as ${label === "projectId" ? "H-012" : "EV-001"}.`);
  }
  return normalized;
}

function safeDate(value?: string): string {
  const date = value?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new VaultProblem("INVALID_INPUT", "Date must use YYYY-MM-DD.", "Provide an ISO date such as 2026-07-18.");
  }
  return date;
}

function safeIsoDateTime(value?: string): string {
  const date = value?.trim() || new Date().toISOString();
  if (Number.isNaN(Date.parse(date))) {
    throw new VaultProblem("INVALID_INPUT", "Timestamp must be a valid ISO-8601 date and time.", "Provide a value such as 2026-07-18T20:00:00-03:00.");
  }
  return new Date(date).toISOString();
}

function limitItems<T>(items: T[] | undefined, label: string): T[] {
  const normalized = items ?? [];
  if (normalized.length > MAX_LIST_ITEMS) {
    throw new VaultProblem("TOO_MANY_ITEMS", `${label} exceeds the ${MAX_LIST_ITEMS}-item limit.`, "Split the workflow into smaller batches.");
  }
  return normalized;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function bullets(items: string[], empty = "Nenhum item informado."): string {
  const values = items.map(text).filter(Boolean);
  return values.length ? values.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
}

function numbered(items: string[], empty = "Nenhum item informado."): string {
  const values = items.map(text).filter(Boolean);
  return values.length ? values.map((item, index) => `${index + 1}. ${item}`).join("\n") : `1. ${empty}`;
}

function table(headers: string[], rows: string[][]): string {
  const safe = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
  const head = `| ${headers.map(safe).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.length ? rows.map((row) => `| ${row.map((value) => safe(value)).join(" | ")} |`).join("\n") : `| ${headers.map((_, index) => index === 0 ? "Nenhum item informado" : "—").join(" | ")} |`;
  return `${head}\n${divider}\n${body}`;
}

function withFrontmatter(properties: Record<string, unknown>, body: string): string {
  return `---\n${stringify(properties, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.trim()}\n`;
}

function checkbox(value: boolean): string {
  return value ? "sim" : "não";
}

function slugTimestamp(iso: string): string {
  return iso.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

export class DeskWorkflowService {
  constructor(private readonly vault: BlobVaultService) {}

  private async writeGeneratedNote(input: {
    path: string;
    content: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    let currentSha: string | undefined;
    try {
      const current = await this.vault.getRecord(input.path);
      currentSha = current.sha256;
      if (!(input.overwrite ?? false)) {
        throw new VaultProblem("ALREADY_EXISTS", `Generated note already exists: ${input.path}`, "Review the existing note, then retry with overwrite=true and its expectedSha256 revision.");
      }
      if (!input.expectedSha256) {
        throw new VaultProblem("REVISION_REQUIRED", `A revision token is required to overwrite ${input.path}.`, "Read the existing note and pass its sha256 as expectedSha256.");
      }
      if (input.expectedSha256 !== current.sha256) {
        throw new VaultProblem("CONFLICT", `The generated note changed since it was read: ${input.path}`, "Read it again and retry using the new sha256.");
      }
    } catch (error) {
      if (!(error instanceof VaultProblem) || error.code !== "NOT_FOUND") throw error;
    }

    const record = await this.vault.putText(input.path, input.content);
    return {
      path: record.path,
      created: currentSha === undefined,
      updated: currentSha !== undefined,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      modifiedAt: record.modifiedAt,
    };
  }

  async materialToProject(input: {
    projectId: string;
    projectName: string;
    objective: string;
    sourceSummary?: string;
    sourcePaths?: string[];
    facts?: string[];
    hypotheses?: Array<{ id?: string; statement: string; confidence?: "low" | "medium" | "high"; status?: string }>;
    evidence?: Array<{ id?: string; summary: string; source?: string; strength?: "weak" | "moderate" | "strong" }>;
    gaps?: string[];
    deliverables?: Array<{ name: string; outcome?: string; acceptanceCriteria?: string[] }>;
    tasks?: Array<{ title: string; deliverable?: string; owner?: string; dueDate?: string; status?: string }>;
    nextAction: string;
    nextSteps: string[];
    outputRoot?: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    const projectId = safeSegment(input.projectId, "projectId");
    const nextSteps = limitItems(input.nextSteps, "nextSteps").map(text).filter(Boolean);
    if (nextSteps.length !== 3) throw new VaultProblem("INVALID_INPUT", "Exactly three next steps are required.", "Provide three short, executable steps.");

    const facts = limitItems(input.facts, "facts");
    const hypotheses = limitItems(input.hypotheses, "hypotheses");
    const evidence = limitItems(input.evidence, "evidence");
    const gaps = limitItems(input.gaps, "gaps");
    const deliverables = limitItems(input.deliverables, "deliverables");
    const tasks = limitItems(input.tasks, "tasks");
    const sources = limitItems(input.sourcePaths, "sourcePaths");
    const root = input.outputRoot?.trim() || `${DEFAULT_ROOT}/Projects`;
    const notePath = path.posix.join(root, projectId, "00_PROJECT_EXECUTABLE.md");
    const generatedAt = new Date().toISOString();

    const body = `# ${text(input.projectName)}\n\n## Objetivo\n\n${text(input.objective)}\n\n## Materiais de origem\n\n${input.sourceSummary ? `${text(input.sourceSummary)}\n\n` : ""}${bullets(sources)}\n\n## Fatos\n\n${bullets(facts)}\n\n## Hipóteses\n\n${table(["ID", "Hipótese", "Confiança", "Situação"], hypotheses.map((item, index) => [text(item.id) || `HYP-${index + 1}`, text(item.statement), text(item.confidence) || "não avaliada", text(item.status) || "aberta"]))}\n\n## Evidências\n\n${table(["ID", "Evidência", "Fonte", "Força"], evidence.map((item, index) => [text(item.id) || `EVD-${index + 1}`, text(item.summary), text(item.source) || "não informada", text(item.strength) || "não avaliada"]))}\n\n## Lacunas\n\n${bullets(gaps)}\n\n## Entregas\n\n${deliverables.length ? deliverables.map((item, index) => `### ${index + 1}. ${text(item.name)}\n\n${item.outcome ? `**Resultado:** ${text(item.outcome)}\n\n` : ""}**Critérios de aceitação**\n\n${bullets(item.acceptanceCriteria ?? [])}`).join("\n\n") : "Nenhuma entrega informada."}\n\n## Tarefas\n\n${table(["Tarefa", "Entrega", "Responsável", "Prazo", "Situação"], tasks.map((item) => [text(item.title), text(item.deliverable) || "—", text(item.owner) || "—", text(item.dueDate) || "—", text(item.status) || "não iniciada"]))}\n\n## Próxima ação única\n\n> ${text(input.nextAction)}\n\n## Três passos executáveis\n\n${numbered(nextSteps)}\n`;

    const result = await this.writeGeneratedNote({
      path: notePath,
      content: withFrontmatter({
        type: "desk-project-executable",
        project_id: projectId,
        project_name: text(input.projectName),
        generated_at: generatedAt,
        facts_count: facts.length,
        hypotheses_count: hypotheses.length,
        evidence_count: evidence.length,
        gaps_count: gaps.length,
        status: "ready_to_execute",
      }, body),
      overwrite: input.overwrite,
      expectedSha256: input.expectedSha256,
    });

    return { ...result, projectId, nextAction: text(input.nextAction), nextSteps, counts: { facts: facts.length, hypotheses: hypotheses.length, evidence: evidence.length, gaps: gaps.length, deliverables: deliverables.length, tasks: tasks.length } };
  }

  async dailyNextAction(input: {
    date?: string;
    projectId?: string;
    captures?: ClassifiedCapture[];
    blockers?: string[];
    nextAction: string;
    steps: string[];
    commitment?: string;
    outputRoot?: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    const date = safeDate(input.date);
    const captures = limitItems(input.captures, "captures");
    const blockers = limitItems(input.blockers, "blockers");
    const steps = limitItems(input.steps, "steps").map(text).filter(Boolean);
    if (steps.length !== 3) throw new VaultProblem("INVALID_INPUT", "Exactly three daily steps are required.", "Provide three small steps that advance the next action.");
    const projectId = input.projectId ? safeSegment(input.projectId, "projectId") : undefined;
    const root = input.outputRoot?.trim() || `${DEFAULT_ROOT}/Daily`;
    const notePath = path.posix.join(root, `${date}_FOCUS.md`);

    const body = `# Foco diário — ${date}\n\n${projectId ? `**Projeto:** ${projectId}\n\n` : ""}## Capturas consolidadas\n\n${table(["Item", "Projeto", "Origem", "Classificação", "Prioridade"], captures.map((item) => [text(item.text), text(item.project) || projectId || "—", text(item.source) || "—", item.classification, item.priority ?? "não definida"]))}\n\n## Bloqueios\n\n${bullets(blockers)}\n\n## Próxima ação única\n\n> ${text(input.nextAction)}\n\n## Três passos\n\n${numbered(steps)}\n\n## Compromisso curto\n\n${text(input.commitment) || "Não informado."}\n`;

    const result = await this.writeGeneratedNote({
      path: notePath,
      content: withFrontmatter({
        type: "desk-daily-focus",
        date,
        project_id: projectId ?? null,
        generated_at: new Date().toISOString(),
        next_action: text(input.nextAction),
        blockers_count: blockers.length,
      }, body),
      overwrite: input.overwrite,
      expectedSha256: input.expectedSha256,
    });

    const byClassification = captures.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.classification] = (accumulator[item.classification] ?? 0) + 1;
      return accumulator;
    }, {});
    return { ...result, date, projectId: projectId ?? null, nextAction: text(input.nextAction), steps, captureCounts: byClassification, blockers: blockers.length };
  }

  async evidenceToDecision(input: {
    evidenceId: string;
    title: string;
    projectId?: string;
    observedAt?: string;
    source: string;
    evidenceType: "qualitative" | "quantitative" | "documentary" | "operational";
    summary: string;
    hypothesisId: string;
    hypothesisStatement: string;
    relation: "supports" | "contradicts" | "neutral";
    strength: "weak" | "moderate" | "strong";
    counterEvidence?: string[];
    decisionProposal: string;
    decisionStatus?: "proposed" | "approved" | "rejected" | "paused";
    rationale: string;
    planChanges?: string[];
    outputRoot?: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    const evidenceId = safeSegment(input.evidenceId, "evidenceId");
    const projectId = input.projectId ? safeSegment(input.projectId, "projectId") : undefined;
    const observedAt = safeIsoDateTime(input.observedAt);
    const counterEvidence = limitItems(input.counterEvidence, "counterEvidence");
    const planChanges = limitItems(input.planChanges, "planChanges");
    const status = input.decisionStatus ?? "proposed";
    const root = input.outputRoot?.trim() || `${DEFAULT_ROOT}/Evidence`;
    const notePath = path.posix.join(root, `${evidenceId}.md`);

    const body = `# ${text(input.title)}\n\n## Classificação\n\n- **ID:** ${evidenceId}\n- **Projeto:** ${projectId ?? "não informado"}\n- **Tipo:** ${input.evidenceType}\n- **Força:** ${input.strength}\n- **Observada em:** ${observedAt}\n- **Fonte:** ${text(input.source)}\n\n## Evidência\n\n${text(input.summary)}\n\n## Hipótese relacionada\n\n- **ID:** ${text(input.hypothesisId)}\n- **Hipótese:** ${text(input.hypothesisStatement)}\n- **Relação:** ${input.relation}\n\n## Contraevidências\n\n${bullets(counterEvidence)}\n\n## Decisão proposta\n\n${text(input.decisionProposal)}\n\n- **Situação:** ${status}\n- **Justificativa resumida:** ${text(input.rationale)}\n\n## Alterações propostas no plano\n\n${bullets(planChanges)}\n`;

    const result = await this.writeGeneratedNote({
      path: notePath,
      content: withFrontmatter({
        type: "desk-evidence-decision",
        evidence_id: evidenceId,
        project_id: projectId ?? null,
        evidence_type: input.evidenceType,
        strength: input.strength,
        hypothesis_id: text(input.hypothesisId),
        relation: input.relation,
        decision_status: status,
        observed_at: observedAt,
        generated_at: new Date().toISOString(),
      }, body),
      overwrite: input.overwrite,
      expectedSha256: input.expectedSha256,
    });

    return { ...result, evidenceId, projectId: projectId ?? null, hypothesisId: text(input.hypothesisId), relation: input.relation, strength: input.strength, decisionStatus: status, planChanges: planChanges.length };
  }

  async multisystemDashboard(input: {
    title?: string;
    generatedAt?: string;
    systems: Array<{
      system: string;
      collectedAt: string;
      status: "ok" | "warning" | "blocked" | "unknown";
      summary: string;
      changes?: string[];
      openItems?: number;
      url?: string;
    }>;
    divergences?: Array<{ topic: string; systems: string[]; description: string; severity: "low" | "medium" | "high" }>;
    risks?: Array<{ id: string; title: string; level: "low" | "medium" | "high"; mitigation?: string }>;
    blockers?: string[];
    nextActions?: Array<{ title: string; owner?: string; dueDate?: string; source?: string }>;
    singleNextAction: string;
    outputPath?: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    const generatedAt = safeIsoDateTime(input.generatedAt);
    const systems = limitItems(input.systems, "systems");
    if (systems.length === 0) throw new VaultProblem("INVALID_INPUT", "At least one system snapshot is required.", "Collect a current snapshot from one or more connected systems.");
    const divergences = limitItems(input.divergences, "divergences");
    const risks = limitItems(input.risks, "risks");
    const blockers = limitItems(input.blockers, "blockers");
    const nextActions = limitItems(input.nextActions, "nextActions");
    const notePath = input.outputPath?.trim() || `${DEFAULT_ROOT}/Dashboards/CURRENT_STATUS.md`;

    for (const system of systems) safeIsoDateTime(system.collectedAt);

    const body = `# ${text(input.title) || "Painel multissistema"}\n\n**Atualizado em:** ${generatedAt}\n\n## Situação por sistema\n\n${table(["Sistema", "Coletado em", "Situação", "Itens abertos", "Resumo", "Endereço"], systems.map((item) => [text(item.system), safeIsoDateTime(item.collectedAt), item.status, item.openItems === undefined ? "—" : String(item.openItems), text(item.summary), text(item.url) || "—"]))}\n\n## Alterações recentes\n\n${systems.map((item) => `### ${text(item.system)}\n\n${bullets(item.changes ?? [])}`).join("\n\n")}\n\n## Divergências\n\n${table(["Tema", "Sistemas", "Severidade", "Descrição"], divergences.map((item) => [text(item.topic), item.systems.map(text).filter(Boolean).join(", "), item.severity, text(item.description)]))}\n\n## Riscos\n\n${table(["ID", "Risco", "Nível", "Mitigação"], risks.map((item) => [text(item.id), text(item.title), item.level, text(item.mitigation) || "não definida"]))}\n\n## Bloqueios\n\n${bullets(blockers)}\n\n## Próximas ações\n\n${table(["Ação", "Responsável", "Prazo", "Origem"], nextActions.map((item) => [text(item.title), text(item.owner) || "—", text(item.dueDate) || "—", text(item.source) || "—"]))}\n\n## Próxima ação única\n\n> ${text(input.singleNextAction)}\n`;

    const result = await this.writeGeneratedNote({
      path: notePath,
      content: withFrontmatter({
        type: "desk-multisystem-dashboard",
        generated_at: generatedAt,
        systems_count: systems.length,
        divergences_count: divergences.length,
        risks_count: risks.length,
        blockers_count: blockers.length,
        next_action: text(input.singleNextAction),
      }, body),
      overwrite: input.overwrite,
      expectedSha256: input.expectedSha256,
    });

    const statusCounts = systems.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.status] = (accumulator[item.status] ?? 0) + 1;
      return accumulator;
    }, {});
    return { ...result, generatedAt, systems: systems.length, statusCounts, divergences: divergences.length, risks: risks.length, blockers: blockers.length, singleNextAction: text(input.singleNextAction) };
  }

  async paperToDigital(input: {
    captureId: string;
    projectId: string;
    weekId: string;
    action: "start" | "status" | "close_day" | "recycle" | "other";
    capturedAt?: string;
    userId?: string;
    imageReference?: string;
    transcription: string;
    confirmedText?: string;
    confidence?: number;
    needsReview?: boolean;
    statusUpdates?: Array<{ field: string; previous?: string; next: string }>;
    completedTasks?: string[];
    newTasks?: Array<{ title: string; steps?: string[] }>;
    notes?: string[];
    nextAction?: string;
    outputRoot?: string;
    overwrite?: boolean;
    expectedSha256?: string;
  }): Promise<Record<string, unknown>> {
    const captureId = safeSegment(input.captureId, "captureId");
    const projectId = safeSegment(input.projectId, "projectId");
    const weekId = safeSegment(input.weekId, "weekId");
    const capturedAt = safeIsoDateTime(input.capturedAt);
    const confidence = input.confidence ?? 0;
    if (confidence < 0 || confidence > 1) throw new VaultProblem("INVALID_INPUT", "Confidence must be between 0 and 1.", "Use a decimal such as 0.85.");
    const statusUpdates = limitItems(input.statusUpdates, "statusUpdates");
    const completedTasks = limitItems(input.completedTasks, "completedTasks");
    const newTasks = limitItems(input.newTasks, "newTasks");
    const notes = limitItems(input.notes, "notes");
    const needsReview = input.needsReview ?? (confidence < 0.8 || !text(input.confirmedText));
    const root = input.outputRoot?.trim() || `${DEFAULT_ROOT}/Paper-Captures`;
    const notePath = path.posix.join(root, projectId, `${weekId}_${captureId}_${slugTimestamp(capturedAt)}.md`);

    const body = `# Captura físico-digital — ${captureId}\n\n## Contexto do código QR\n\n- **Projeto:** ${projectId}\n- **Semana:** ${weekId}\n- **Ação:** ${input.action}\n- **Usuário:** ${text(input.userId) || "não informado"}\n- **Capturado em:** ${capturedAt}\n- **Referência da imagem:** ${text(input.imageReference) || "não informada"}\n\n## Transcrição bruta\n\n${text(input.transcription)}\n\n## Texto confirmado\n\n${text(input.confirmedText) || "Aguardando confirmação."}\n\n## Qualidade da interpretação\n\n- **Confiança:** ${confidence.toFixed(2)}\n- **Revisão humana necessária:** ${checkbox(needsReview)}\n\n## Atualizações de situação\n\n${table(["Campo", "Antes", "Depois"], statusUpdates.map((item) => [text(item.field), text(item.previous) || "—", text(item.next)]))}\n\n## Tarefas concluídas\n\n${bullets(completedTasks)}\n\n## Novas tarefas\n\n${newTasks.length ? newTasks.map((item, index) => `### ${index + 1}. ${text(item.title)}\n\n${item.steps?.length ? numbered(item.steps) : "Sem passos detalhados."}`).join("\n\n") : "Nenhuma nova tarefa informada."}\n\n## Notas adicionais\n\n${bullets(notes)}\n\n## Próxima ação sugerida\n\n${text(input.nextAction) || "Revisar a captura e confirmar as alterações digitais."}\n`;

    const result = await this.writeGeneratedNote({
      path: notePath,
      content: withFrontmatter({
        type: "desk-paper-capture",
        capture_id: captureId,
        project_id: projectId,
        week_id: weekId,
        action: input.action,
        captured_at: capturedAt,
        confidence,
        needs_review: needsReview,
        generated_at: new Date().toISOString(),
      }, body),
      overwrite: input.overwrite,
      expectedSha256: input.expectedSha256,
    });

    return { ...result, captureId, projectId, weekId, action: input.action, confidence, needsReview, updates: statusUpdates.length, completedTasks: completedTasks.length, newTasks: newTasks.length, nextAction: text(input.nextAction) || "Revisar a captura e confirmar as alterações digitais." };
  }
}
