import path from "node:path";
import { BlobVaultService, VaultProblem } from "./vault.js";
import { buildVaultViewUrl } from "./viewer.js";

const DEFAULT_ROOT = "DESK-OS/Dashboards/Workflows";
const MAX_ITEMS = 100;
const GENERATED_MARKER = "<!-- DESK-OS GENERATED WORKFLOW DASHBOARD v1.6 -->";

export type WorkflowGateDecision = "AVANÇAR" | "CORRIGIR" | "PAUSAR" | "ENCERRAR";
export type WorkflowAreaScore = 0 | 1 | 2 | 3;

export type WorkflowDashboardSource = {
  id: string;
  title?: string;
  path?: string;
  kind?: string;
  status?: string;
};

export type WorkflowDashboardArea = {
  id: string;
  label: string;
  score: WorkflowAreaScore;
  note?: string;
};

export type WorkflowDashboardDecision = {
  id: string;
  title: string;
  status: "proposed" | "approved" | "rejected" | "paused";
  caveat?: string;
};

export type WorkflowDashboardGap = {
  id: string;
  title: string;
  impact: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "paused";
  owner?: string;
  dueDate?: string;
};

export type WorkflowDashboardCounterEvidence = {
  id: string;
  title: string;
  impact?: string;
  status: "open" | "resolved" | "paused";
};

export type WorkflowDashboardRisk = {
  id: string;
  title: string;
  level: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigated" | "closed";
  mitigation?: string;
};

export type WorkflowDashboardState = {
  schemaVersion: "1.0";
  workflowId: string;
  title: string;
  subtitle?: string;
  sourceDocument?: string;
  documentVersion?: string;
  updatedAt: string;
  updateSequence: number;
  gate: {
    decision: WorkflowGateDecision;
    summary: string;
    exitCondition?: string;
  };
  sources: WorkflowDashboardSource[];
  areas: WorkflowDashboardArea[];
  decisions: WorkflowDashboardDecision[];
  gaps: WorkflowDashboardGap[];
  counterEvidence: WorkflowDashboardCounterEvidence[];
  risks: WorkflowDashboardRisk[];
  nextAction?: string;
  ingestionSummary?: string;
  sourcePaths: string[];
};

export type WorkflowDashboardInput = {
  workflowId: string;
  title: string;
  subtitle?: string;
  sourceDocument?: string;
  documentVersion?: string;
  observedAt?: string;
  mode?: "replace" | "upsert";
  gate: {
    decision: WorkflowGateDecision;
    summary: string;
    exitCondition?: string;
  };
  sources?: WorkflowDashboardSource[];
  areas?: WorkflowDashboardArea[];
  decisions?: WorkflowDashboardDecision[];
  gaps?: WorkflowDashboardGap[];
  counterEvidence?: WorkflowDashboardCounterEvidence[];
  risks?: WorkflowDashboardRisk[];
  nextAction?: string;
  ingestionSummary?: string;
  sourcePaths?: string[];
  remove?: {
    sourceIds?: string[];
    areaIds?: string[];
    decisionIds?: string[];
    gapIds?: string[];
    counterEvidenceIds?: string[];
    riskIds?: string[];
  };
  outputRoot?: string;
  expectedStateSha256?: string;
  writeHistory?: boolean;
};

function safeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(normalized)) {
    throw new VaultProblem("INVALID_INPUT", `${label} must use only letters, numbers, hyphens, and underscores.`, "Use a stable identifier such as WORKOS-CONSULTORIA.");
  }
  return normalized;
}

function safeIso(value?: string): string {
  const candidate = value?.trim() || new Date().toISOString();
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    throw new VaultProblem("INVALID_INPUT", "observedAt must be a valid ISO-8601 timestamp.", "Use a value such as 2026-07-19T10:00:00-03:00.");
  }
  return new Date(parsed).toISOString();
}

function safeText(value: unknown, max = 10_000): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) {
    throw new VaultProblem("INVALID_INPUT", `Text exceeds the ${max}-character limit.`, "Shorten the field or split the ingestion into smaller updates.");
  }
  return normalized;
}

function safeId(value: string, label = "id"): string {
  const normalized = safeText(value, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(normalized)) {
    throw new VaultProblem("INVALID_INPUT", `${label} contains unsupported characters.`, "Use a stable identifier such as GAP-010 or DEC-001.");
  }
  return normalized;
}

function limited<T>(items: T[] | undefined, label: string): T[] | undefined {
  if (items === undefined) return undefined;
  if (items.length > MAX_ITEMS) {
    throw new VaultProblem("TOO_MANY_ITEMS", `${label} exceeds the ${MAX_ITEMS}-item limit.`, "Split the ingestion into smaller batches.");
  }
  return items;
}

function normalizeDate(value: string | undefined, label: string): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new VaultProblem("INVALID_INPUT", `${label} must use YYYY-MM-DD.`, "Provide an ISO date such as 2026-08-01.");
  }
  return normalized;
}

function normalizeSources(items: WorkflowDashboardSource[] | undefined): WorkflowDashboardSource[] | undefined {
  return limited(items, "sources")?.map((item) => ({
    id: safeId(item.id, "source id"),
    ...(safeText(item.title, 500) ? { title: safeText(item.title, 500) } : {}),
    ...(safeText(item.path, 600) ? { path: safeText(item.path, 600) } : {}),
    ...(safeText(item.kind, 100) ? { kind: safeText(item.kind, 100) } : {}),
    ...(safeText(item.status, 100) ? { status: safeText(item.status, 100) } : {}),
  }));
}

function normalizeAreas(items: WorkflowDashboardArea[] | undefined): WorkflowDashboardArea[] | undefined {
  return limited(items, "areas")?.map((item) => {
    if (![0, 1, 2, 3].includes(item.score)) {
      throw new VaultProblem("INVALID_INPUT", "Area score must be 0, 1, 2, or 3.", "Use 0=vazio, 1=iniciado, 2=em andamento, 3=completo.");
    }
    return {
      id: safeId(item.id, "area id"),
      label: safeText(item.label, 300),
      score: item.score,
      ...(safeText(item.note, 2_000) ? { note: safeText(item.note, 2_000) } : {}),
    };
  });
}

function normalizeDecisions(items: WorkflowDashboardDecision[] | undefined): WorkflowDashboardDecision[] | undefined {
  return limited(items, "decisions")?.map((item) => ({
    id: safeId(item.id, "decision id"),
    title: safeText(item.title, 2_000),
    status: item.status,
    ...(safeText(item.caveat, 2_000) ? { caveat: safeText(item.caveat, 2_000) } : {}),
  }));
}

function normalizeGaps(items: WorkflowDashboardGap[] | undefined): WorkflowDashboardGap[] | undefined {
  return limited(items, "gaps")?.map((item) => ({
    id: safeId(item.id, "gap id"),
    title: safeText(item.title, 2_000),
    impact: safeText(item.impact, 2_000),
    priority: item.priority,
    status: item.status,
    ...(safeText(item.owner, 300) ? { owner: safeText(item.owner, 300) } : {}),
    ...(normalizeDate(item.dueDate, "gap dueDate") ? { dueDate: normalizeDate(item.dueDate, "gap dueDate") } : {}),
  }));
}

function normalizeCounterEvidence(items: WorkflowDashboardCounterEvidence[] | undefined): WorkflowDashboardCounterEvidence[] | undefined {
  return limited(items, "counterEvidence")?.map((item) => ({
    id: safeId(item.id, "counter-evidence id"),
    title: safeText(item.title, 2_000),
    ...(safeText(item.impact, 2_000) ? { impact: safeText(item.impact, 2_000) } : {}),
    status: item.status,
  }));
}

function normalizeRisks(items: WorkflowDashboardRisk[] | undefined): WorkflowDashboardRisk[] | undefined {
  return limited(items, "risks")?.map((item) => ({
    id: safeId(item.id, "risk id"),
    title: safeText(item.title, 2_000),
    level: item.level,
    status: item.status,
    ...(safeText(item.mitigation, 2_000) ? { mitigation: safeText(item.mitigation, 2_000) } : {}),
  }));
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[] | undefined, mode: "replace" | "upsert", removeIds: string[] | undefined): T[] {
  const remove = new Set((removeIds ?? []).map((value) => safeId(value, "removed id")));
  if (mode === "replace") return (incoming ?? []).filter((item) => !remove.has(item.id));
  const values = new Map(current.map((item) => [item.id, item]));
  for (const id of remove) values.delete(id);
  for (const item of incoming ?? []) values.set(item.id, item);
  return [...values.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function classToken(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function statusLabel(score: WorkflowAreaScore): string {
  return ["Vazio", "Iniciado", "Em andamento", "Completo"][score] ?? "Desconhecido";
}

function tableRows(rows: string[][], columns: number, empty = "Nenhum item registrado."): string {
  if (!rows.length) return `<tr><td colspan="${columns}" class="empty-cell">${htmlEscape(empty)}</td></tr>`;
  return rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
}

function countOpen<T extends { status: string }>(items: T[], openStatuses: string[]): number {
  return items.filter((item) => openStatuses.includes(item.status)).length;
}

function renderAreaRows(areas: WorkflowDashboardArea[]): string {
  if (!areas.length) return `<div class="empty">Nenhuma área avaliada nesta ingestão.</div>`;
  return areas.map((area) => {
    const percentage = Math.round((area.score / 3) * 100);
    return `<div class="area-row">
      <div class="area-label"><span>${htmlEscape(area.label)}</span><small>${htmlEscape(area.id)}</small></div>
      <div class="bar-track" aria-label="${htmlEscape(area.label)}: ${htmlEscape(statusLabel(area.score))}"><span style="width:${percentage}%"></span></div>
      <div class="area-score">${area.score}/3</div>
      ${area.note ? `<div class="area-note">${htmlEscape(area.note)}</div>` : ""}
    </div>`;
  }).join("");
}

function donutGradient(values: number[]): string {
  const colors = ["#4fd1a5", "#ffb454", "#ff6b6b", "#5fa8ff"];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return "conic-gradient(#263041 0 100%)";
  let cursor = 0;
  const stops: string[] = [];
  values.forEach((value, index) => {
    const start = cursor;
    cursor += (value / total) * 100;
    stops.push(`${colors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);
  });
  return `conic-gradient(${stops.join(",")})`;
}

function humanLabel(value: string): string {
  const labels: Record<string, string> = {
    approved: "Aprovada", proposed: "Proposta", rejected: "Rejeitada", paused: "Pausada",
    open: "Aberto", resolved: "Resolvido", mitigated: "Mitigado", closed: "Encerrado",
    low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica",
  };
  return labels[value] ?? value;
}

function gateAccent(decision: WorkflowGateDecision): string {
  if (decision === "AVANÇAR") return "ok";
  if (decision === "CORRIGIR") return "accent";
  if (decision === "ENCERRAR") return "risk";
  return "gap";
}

export function renderWorkflowDashboardHtml(state: WorkflowDashboardState): string {
  const approved = state.decisions.filter((item) => item.status === "approved").length;
  const openGaps = countOpen(state.gaps, ["open", "paused"]);
  const openCounterEvidence = countOpen(state.counterEvidence, ["open", "paused"]);
  const openRisks = countOpen(state.risks, ["open"]);
  const distribution = [approved, openGaps, openCounterEvidence, openRisks];
  const gateClass = gateAccent(state.gate.decision);
  const sourceLabel = state.sourceDocument || state.sourcePaths[0] || "workflow estruturado";
  const updated = new Date(state.updatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return `${GENERATED_MARKER}
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(state.title)} — Status dinâmico</title>
<style>
:root{--bg:#0d1117;--panel:#151b23;--panel-border:#263041;--text:#e6edf3;--muted:#8b98a5;--accent:#5fa8ff;--gap:#ffb454;--risk:#ff6b6b;--ok:#4fd1a5;--mono:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:32px 24px 64px}.wrap{max-width:1120px;margin:0 auto}header{margin-bottom:28px}.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 8px}h1{font-size:clamp(24px,4vw,32px);margin:0 0 6px;font-weight:680}.sub{color:var(--muted);font-size:14px;margin:0}.gate-banner{margin-top:20px;display:flex;align-items:flex-start;gap:16px;border:1px solid var(--panel-border);border-radius:10px;padding:16px 20px;background:var(--panel)}.gate-banner.gap{border-color:rgba(255,180,84,.4);background:linear-gradient(135deg,rgba(255,180,84,.12),rgba(255,180,84,.03))}.gate-banner.ok{border-color:rgba(79,209,165,.4);background:linear-gradient(135deg,rgba(79,209,165,.12),rgba(79,209,165,.03))}.gate-banner.risk{border-color:rgba(255,107,107,.4);background:linear-gradient(135deg,rgba(255,107,107,.12),rgba(255,107,107,.03))}.gate-banner.accent{border-color:rgba(95,168,255,.4);background:linear-gradient(135deg,rgba(95,168,255,.12),rgba(95,168,255,.03))}.gate-badge{font-family:var(--mono);font-weight:800;font-size:14px;color:#0d1117;padding:7px 14px;border-radius:6px;white-space:nowrap}.gap .gate-badge{background:var(--gap)}.ok .gate-badge{background:var(--ok)}.risk .gate-badge{background:var(--risk)}.accent .gate-badge{background:var(--accent)}.gate-text{font-size:13px;line-height:1.55}.gate-text strong{display:block;margin-bottom:4px}.gate-text span{display:block;color:var(--muted)}.grid{display:grid;grid-template-columns:1.45fr 1fr;gap:20px;margin-top:28px}.panel{background:var(--panel);border:1px solid var(--panel-border);border-radius:12px;padding:20px}.panel h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 4px;font-weight:650}.hint{font-size:12px;color:var(--muted);margin:0 0 16px}.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:28px}.stat{background:var(--panel);border:1px solid var(--panel-border);border-radius:10px;padding:16px}.stat .n{font-size:26px;font-weight:750;font-family:var(--mono)}.stat .l{font-size:12px;color:var(--muted);margin-top:4px}.stat.risk .n{color:var(--risk)}.stat.gap .n{color:var(--gap)}.stat.ok .n{color:var(--ok)}.stat.accent .n{color:var(--accent)}.area-row{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(160px,2fr) 45px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(38,48,65,.65)}.area-label span{display:block;font-size:12px}.area-label small{display:block;color:var(--muted);font-family:var(--mono);font-size:10px}.bar-track{height:12px;border-radius:4px;background:#263041;overflow:hidden}.bar-track span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--ok));border-radius:4px}.area-score{font-family:var(--mono);font-size:11px;color:var(--muted);text-align:right}.area-note{grid-column:1/-1;color:var(--muted);font-size:11px;padding-left:4px}.donut-wrap{display:grid;place-items:center;gap:18px;padding:12px 0}.donut{width:min(220px,62vw);aspect-ratio:1;border-radius:50%;background:${donutGradient(distribution)};display:grid;place-items:center}.donut::after{content:"${distribution.reduce((a,b)=>a+b,0)}";width:58%;aspect-ratio:1;border-radius:50%;background:var(--panel);display:grid;place-items:center;font:700 28px var(--mono);color:var(--text)}.legend{width:100%;display:grid;gap:8px}.legend-row{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center;font-size:12px}.dot{width:10px;height:10px;border-radius:2px}.dot.ok{background:var(--ok)}.dot.gap{background:var(--gap)}.dot.risk{background:var(--risk)}.dot.accent{background:var(--accent)}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--panel-border);vertical-align:top}th{color:var(--muted);font-weight:650;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.id{font-family:var(--mono);color:var(--accent);white-space:nowrap}.pill{display:inline-block;font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(139,152,165,.14);color:var(--muted)}.pill.approved,.pill.resolved,.pill.closed,.pill.mitigated{background:rgba(79,209,165,.15);color:var(--ok)}.pill.open,.pill.high,.pill.critical{background:rgba(255,180,84,.15);color:var(--gap)}.pill.rejected{background:rgba(255,107,107,.15);color:var(--risk)}.pill.proposed,.pill.paused,.pill.medium{background:rgba(95,168,255,.15);color:var(--accent)}.empty,.empty-cell{color:var(--muted);font-size:12px;padding:16px 0}.next-action{margin-top:20px;border-left:4px solid var(--accent);background:rgba(95,168,255,.08);padding:14px 16px}.next-action strong{display:block;color:var(--accent);font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}.table-wrap{overflow:auto}footer{margin-top:32px;font-size:11px;color:var(--muted);text-align:center;line-height:1.6}@media(max-width:800px){body{padding:22px 14px 48px}.grid{grid-template-columns:1fr}.stat-row{grid-template-columns:repeat(2,1fr)}.gate-banner{flex-direction:column}.area-row{grid-template-columns:1fr 70px}.bar-track{grid-column:1/-1;grid-row:2}.area-note{grid-row:3}.table-wrap{margin-inline:-6px}}@media print{body{background:#fff;color:#111;padding:10mm}.panel,.stat,.gate-banner{background:#fff;border-color:#bbb;break-inside:avoid}.sub,.hint,.stat .l,.area-label small,.area-score,footer{color:#555}.grid{grid-template-columns:1fr}.donut::after{background:#fff;color:#111}}
</style>
</head>
<body><div class="wrap">
<header><p class="eyebrow">DESK-OS · Status Dinâmico · atualização ${state.updateSequence}</p><h1>${htmlEscape(state.title)}</h1><p class="sub">${htmlEscape(state.subtitle || `Gerado a partir de ${sourceLabel}`)}${state.documentVersion ? ` · versão ${htmlEscape(state.documentVersion)}` : ""} · atualizado em ${htmlEscape(updated)}</p>
<div class="gate-banner ${gateClass}"><div class="gate-badge">${htmlEscape(state.gate.decision)}</div><div class="gate-text"><strong>${htmlEscape(state.gate.summary)}</strong>${state.gate.exitCondition ? `<span>Condição de saída: ${htmlEscape(state.gate.exitCondition)}</span>` : ""}</div></div></header>
<section class="stat-row" aria-label="Indicadores"><div class="stat accent"><div class="n">${state.sources.length}</div><div class="l">Insumos analisados</div></div><div class="stat ok"><div class="n">${approved}</div><div class="l">Decisões aprovadas</div></div><div class="stat gap"><div class="n">${openGaps}</div><div class="l">Lacunas abertas</div></div><div class="stat risk"><div class="n">${openRisks}</div><div class="l">Riscos abertos</div></div></section>
<section class="grid"><div class="panel"><h2>Status por área</h2><p class="hint">0=vazio · 1=iniciado · 2=em andamento · 3=completo. Valores estruturados pelo workflow.</p>${renderAreaRows(state.areas)}</div><div class="panel"><h2>Decisões, lacunas e risco</h2><p class="hint">Distribuição calculada automaticamente a partir do estado atual.</p><div class="donut-wrap"><div class="donut" role="img" aria-label="${approved} decisões aprovadas, ${openGaps} lacunas abertas, ${openCounterEvidence} contraevidências abertas e ${openRisks} riscos abertos"></div><div class="legend"><div class="legend-row"><span class="dot ok"></span><span>Decisões aprovadas</span><strong>${approved}</strong></div><div class="legend-row"><span class="dot gap"></span><span>Lacunas abertas</span><strong>${openGaps}</strong></div><div class="legend-row"><span class="dot risk"></span><span>Contraevidências abertas</span><strong>${openCounterEvidence}</strong></div><div class="legend-row"><span class="dot accent"></span><span>Riscos abertos</span><strong>${openRisks}</strong></div></div></div></div></section>
<section class="panel" style="margin-top:20px"><h2>Lacunas</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Informação ausente</th><th>Impacto</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>${tableRows(state.gaps.map((item) => [`<span class="id">${htmlEscape(item.id)}</span>`,htmlEscape(item.title),htmlEscape(item.impact),`<span class="pill ${classToken(item.priority)}">${htmlEscape(humanLabel(item.priority))}</span>`,`<span class="pill ${classToken(item.status)}">${htmlEscape(humanLabel(item.status))}</span>`]),5,"Nenhuma lacuna registrada.")}</tbody></table></div></section>
<section class="panel" style="margin-top:20px"><h2>Decisões registradas</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Título</th><th>Status</th><th>Ressalva</th></tr></thead><tbody>${tableRows(state.decisions.map((item) => [`<span class="id">${htmlEscape(item.id)}</span>`,htmlEscape(item.title),`<span class="pill ${classToken(item.status)}">${htmlEscape(humanLabel(item.status))}</span>`,htmlEscape(item.caveat || "—")]),4,"Nenhuma decisão registrada.")}</tbody></table></div></section>
<section class="grid"><div class="panel"><h2>Riscos</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Risco</th><th>Nível</th><th>Status</th></tr></thead><tbody>${tableRows(state.risks.map((item) => [`<span class="id">${htmlEscape(item.id)}</span>`,htmlEscape(item.title),`<span class="pill ${classToken(item.level)}">${htmlEscape(humanLabel(item.level))}</span>`,`<span class="pill ${classToken(item.status)}">${htmlEscape(humanLabel(item.status))}</span>`]),4,"Nenhum risco registrado.")}</tbody></table></div></div><div class="panel"><h2>Contraevidências</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Contraevidência</th><th>Status</th></tr></thead><tbody>${tableRows(state.counterEvidence.map((item) => [`<span class="id">${htmlEscape(item.id)}</span>`,htmlEscape(item.title),`<span class="pill ${classToken(item.status)}">${htmlEscape(humanLabel(item.status))}</span>`]),3,"Nenhuma contraevidência registrada.")}</tbody></table></div></div></section>
${state.nextAction ? `<section class="next-action"><strong>Próxima ação única</strong>${htmlEscape(state.nextAction)}</section>` : ""}
<footer>Fonte: ${htmlEscape(sourceLabel)} · estado estruturado em WORKFLOW_STATUS.json · atualização automática após ingestão do workflow · sequência ${state.updateSequence}</footer>
</div></body></html>`;
}

function dashboardIndexMarkdown(state: WorkflowDashboardState, dashboardPath: string, statePath: string, dashboardUrl?: string): string {
  const link = dashboardUrl ? `[Abrir dashboard dinâmico](${dashboardUrl})` : `Arquivo HTML: \`${dashboardPath}\``;
  return `---\ntype: desk-workflow-dashboard-index\nworkflow_id: ${state.workflowId}\nupdated_at: ${state.updatedAt}\nupdate_sequence: ${state.updateSequence}\ngate_decision: ${state.gate.decision}\n---\n\n# ${state.title}\n\n${link}\n\n## Arquivos gerados\n\n- Estado estruturado: \`${statePath}\`\n- Dashboard HTML: \`${dashboardPath}\`\n\n## Situação atual\n\n- **Gate:** ${state.gate.decision}\n- **Resumo:** ${state.gate.summary}\n- **Insumos:** ${state.sources.length}\n- **Decisões aprovadas:** ${state.decisions.filter((item) => item.status === "approved").length}\n- **Lacunas abertas:** ${countOpen(state.gaps, ["open", "paused"])}\n- **Riscos abertos:** ${countOpen(state.risks, ["open"])}\n\n## Próxima ação\n\n${state.nextAction || "Não informada."}\n\n> Este índice e o HTML são regenerados pelo workflow. Edite o estado apenas por meio de \`desk_ingest_workflow_dashboard\`.\n`;
}

function initialState(input: WorkflowDashboardInput, observedAt: string): WorkflowDashboardState {
  return {
    schemaVersion: "1.0",
    workflowId: safeSegment(input.workflowId, "workflowId"),
    title: safeText(input.title, 300),
    ...(safeText(input.subtitle, 1_000) ? { subtitle: safeText(input.subtitle, 1_000) } : {}),
    ...(safeText(input.sourceDocument, 600) ? { sourceDocument: safeText(input.sourceDocument, 600) } : {}),
    ...(safeText(input.documentVersion, 100) ? { documentVersion: safeText(input.documentVersion, 100) } : {}),
    updatedAt: observedAt,
    updateSequence: 0,
    gate: {
      decision: input.gate.decision,
      summary: safeText(input.gate.summary, 3_000),
      ...(safeText(input.gate.exitCondition, 2_000) ? { exitCondition: safeText(input.gate.exitCondition, 2_000) } : {}),
    },
    sources: [],
    areas: [],
    decisions: [],
    gaps: [],
    counterEvidence: [],
    risks: [],
    ...(safeText(input.nextAction, 2_000) ? { nextAction: safeText(input.nextAction, 2_000) } : {}),
    ...(safeText(input.ingestionSummary, 5_000) ? { ingestionSummary: safeText(input.ingestionSummary, 5_000) } : {}),
    sourcePaths: [],
  };
}

function parseState(raw: string, workflowId: string): WorkflowDashboardState {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new VaultProblem("INVALID_STATE", "The existing workflow dashboard state is not valid JSON.", "Restore WORKFLOW_STATUS.json from history or use mode=replace with a new outputRoot."); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VaultProblem("INVALID_STATE", "The existing workflow dashboard state is malformed.", "Restore the state file from history.");
  }
  const state = value as WorkflowDashboardState;
  if (state.schemaVersion !== "1.0" || state.workflowId !== workflowId) {
    throw new VaultProblem("INVALID_STATE", "The existing state belongs to a different workflow or schema.", "Use a separate workflowId or outputRoot.");
  }
  return state;
}

function applyUpdate(current: WorkflowDashboardState, input: WorkflowDashboardInput, observedAt: string): WorkflowDashboardState {
  const mode = input.mode ?? "upsert";
  const sources = normalizeSources(input.sources);
  const areas = normalizeAreas(input.areas);
  const decisions = normalizeDecisions(input.decisions);
  const gaps = normalizeGaps(input.gaps);
  const counterEvidence = normalizeCounterEvidence(input.counterEvidence);
  const risks = normalizeRisks(input.risks);
  const sourcePaths = limited(input.sourcePaths, "sourcePaths")?.map((item) => safeText(item, 600)).filter(Boolean);

  return {
    ...current,
    title: safeText(input.title, 300),
    ...(input.subtitle !== undefined ? (safeText(input.subtitle, 1_000) ? { subtitle: safeText(input.subtitle, 1_000) } : { subtitle: undefined }) : {}),
    ...(input.sourceDocument !== undefined ? (safeText(input.sourceDocument, 600) ? { sourceDocument: safeText(input.sourceDocument, 600) } : { sourceDocument: undefined }) : {}),
    ...(input.documentVersion !== undefined ? (safeText(input.documentVersion, 100) ? { documentVersion: safeText(input.documentVersion, 100) } : { documentVersion: undefined }) : {}),
    updatedAt: observedAt,
    updateSequence: current.updateSequence + 1,
    gate: {
      decision: input.gate.decision,
      summary: safeText(input.gate.summary, 3_000),
      ...(safeText(input.gate.exitCondition, 2_000) ? { exitCondition: safeText(input.gate.exitCondition, 2_000) } : {}),
    },
    sources: mergeById(current.sources, sources, mode, input.remove?.sourceIds),
    areas: mergeById(current.areas, areas, mode, input.remove?.areaIds),
    decisions: mergeById(current.decisions, decisions, mode, input.remove?.decisionIds),
    gaps: mergeById(current.gaps, gaps, mode, input.remove?.gapIds),
    counterEvidence: mergeById(current.counterEvidence, counterEvidence, mode, input.remove?.counterEvidenceIds),
    risks: mergeById(current.risks, risks, mode, input.remove?.riskIds),
    ...(input.nextAction !== undefined ? (safeText(input.nextAction, 2_000) ? { nextAction: safeText(input.nextAction, 2_000) } : { nextAction: undefined }) : {}),
    ...(input.ingestionSummary !== undefined ? (safeText(input.ingestionSummary, 5_000) ? { ingestionSummary: safeText(input.ingestionSummary, 5_000) } : { ingestionSummary: undefined }) : {}),
    sourcePaths: mode === "replace" ? (sourcePaths ?? []) : [...new Set([...current.sourcePaths, ...(sourcePaths ?? [])])].sort(),
  };
}

export function buildWorkflowDashboardUrl(publicBaseUrl: string, dashboardPath: string): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/dashboard?path=${encodeURIComponent(dashboardPath)}`;
}

export class WorkflowDashboardService {
  constructor(private readonly vault: BlobVaultService, private readonly publicBaseUrl?: string) {}

  async ingest(input: WorkflowDashboardInput): Promise<Record<string, unknown>> {
    const workflowId = safeSegment(input.workflowId, "workflowId");
    const observedAt = safeIso(input.observedAt);
    const root = safeText(input.outputRoot, 500) || DEFAULT_ROOT;
    const workflowRoot = path.posix.join(root, workflowId);
    const statePath = path.posix.join(workflowRoot, "WORKFLOW_STATUS.json");
    const dashboardPath = path.posix.join(workflowRoot, "STATUS_DASHBOARD.html");
    const indexPath = path.posix.join(workflowRoot, "DASHBOARD.md");

    let currentRecordSha: string | undefined;
    let current = initialState(input, observedAt);
    try {
      const existing = await this.vault.getFileBytes(statePath);
      currentRecordSha = existing.record.sha256;
      if (input.expectedStateSha256 && input.expectedStateSha256 !== existing.record.sha256) {
        throw new VaultProblem("CONFLICT", "The workflow dashboard state changed since it was read.", "Read WORKFLOW_STATUS.json again and retry with its current sha256.");
      }
      current = parseState(Buffer.from(existing.bytes).toString("utf8"), workflowId);
    } catch (error) {
      if (!(error instanceof VaultProblem) || error.code !== "NOT_FOUND") throw error;
      if (input.expectedStateSha256) {
        throw new VaultProblem("NOT_FOUND", "expectedStateSha256 was supplied, but no state file exists.", "Remove expectedStateSha256 for the first ingestion.");
      }
    }

    const next = applyUpdate(current, input, observedAt);
    const dashboardUrl = this.publicBaseUrl ? buildWorkflowDashboardUrl(this.publicBaseUrl, dashboardPath) : undefined;
    const stateContent = `${JSON.stringify(next, null, 2)}\n`;
    const dashboardContent = renderWorkflowDashboardHtml(next);
    const indexContent = dashboardIndexMarkdown(next, dashboardPath, statePath, dashboardUrl);
    const historyPath = path.posix.join(workflowRoot, "history", `${observedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}_${String(next.updateSequence).padStart(4, "0")}.json`);

    const stateRecord = await this.vault.putBytes(statePath, Buffer.from(stateContent, "utf8"), observedAt, { mimeType: "application/json", originalName: "WORKFLOW_STATUS.json" });
    const dashboardRecord = await this.vault.putBytes(dashboardPath, Buffer.from(dashboardContent, "utf8"), observedAt, { mimeType: "text/html", originalName: "STATUS_DASHBOARD.html" });
    const indexRecord = await this.vault.putBytes(indexPath, Buffer.from(indexContent, "utf8"), observedAt, { mimeType: "text/markdown", originalName: "DASHBOARD.md" });
    let historyRecord: { path: string; sha256: string } | undefined;
    if (input.writeHistory ?? true) {
      const written = await this.vault.putBytes(historyPath, Buffer.from(stateContent, "utf8"), observedAt, { mimeType: "application/json", originalName: path.posix.basename(historyPath) });
      historyRecord = { path: written.path, sha256: written.sha256 };
    }

    const approved = next.decisions.filter((item) => item.status === "approved").length;
    const openGaps = countOpen(next.gaps, ["open", "paused"]);
    const openRisks = countOpen(next.risks, ["open"]);
    return {
      workflowId,
      mode: input.mode ?? "upsert",
      created: currentRecordSha === undefined,
      updated: currentRecordSha !== undefined,
      previousStateSha256: currentRecordSha ?? null,
      updateSequence: next.updateSequence,
      updatedAt: next.updatedAt,
      gateDecision: next.gate.decision,
      counts: {
        sources: next.sources.length,
        areas: next.areas.length,
        decisions: next.decisions.length,
        approvedDecisions: approved,
        gaps: next.gaps.length,
        openGaps,
        counterEvidence: next.counterEvidence.length,
        risks: next.risks.length,
        openRisks,
      },
      state: {
        path: stateRecord.path,
        sha256: stateRecord.sha256,
        viewUrl: this.publicBaseUrl ? buildVaultViewUrl(this.publicBaseUrl, stateRecord.path) : undefined,
      },
      dashboard: {
        path: dashboardRecord.path,
        sha256: dashboardRecord.sha256,
        dashboardUrl,
        viewUrl: this.publicBaseUrl ? buildVaultViewUrl(this.publicBaseUrl, dashboardRecord.path) : undefined,
      },
      index: {
        path: indexRecord.path,
        sha256: indexRecord.sha256,
        viewUrl: this.publicBaseUrl ? buildVaultViewUrl(this.publicBaseUrl, indexRecord.path) : undefined,
      },
      history: historyRecord,
      nextAction: next.nextAction ?? null,
    };
  }
}

export function isGeneratedWorkflowDashboard(content: string): boolean {
  return content.startsWith(GENERATED_MARKER);
}
