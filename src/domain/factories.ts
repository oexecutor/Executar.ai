import { newId } from "./ids.js";
import type {
  DecompositionProposal,
  EvidenceRecord,
  Project,
  Sprint,
  Task,
  TaskStep,
} from "./entities.js";
import type {
  AddEvidenceInput,
  CreateProjectInput,
  CreateSprintInput,
  CreateTaskInput,
  PrepareProposalInput,
} from "./schemas.js";

function nowIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_WORKSPACE_ID = "wsp_leonardo";

export function makeProject(
  input: CreateProjectInput,
  workspaceId = DEFAULT_WORKSPACE_ID,
  ownerId = "leonardo",
): Project {
  const at = nowIso();
  return {
    id: newId("project"),
    workspaceId,
    title: input.title,
    objective: input.objective,
    context: input.context,
    scopeIn: input.scopeIn,
    scopeOut: input.scopeOut,
    definitionOfDone: input.definitionOfDone,
    status: "PLANNED",
    priority: input.priority,
    ownerId,
    startAt: null,
    dueAt: null,
    tags: input.tags,
    noteRefs: input.noteRefs,
    evidenceRefs: [],
    archivedAt: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

export function makeSprint(input: CreateSprintInput): Sprint {
  const at = nowIso();
  return {
    id: newId("sprint"),
    projectId: input.projectId,
    title: input.title,
    goal: input.goal,
    status: "PLANNED",
    startDate: input.startDate,
    endDate: input.endDate,
    capacityHours: input.capacityHours,
    wipLimit: input.wipLimit,
    reviewSummary: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

export function makeStep(title: string, status: TaskStep["status"] = "TODO"): TaskStep {
  return { id: newId("step"), title, status };
}

export function makeTask(input: CreateTaskInput, position: number): Task {
  const at = nowIso();
  return {
    id: newId("task"),
    projectId: input.projectId,
    sprintId: input.sprintId,
    deliverableId: null,
    title: input.title,
    outcome: input.outcome,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    status: "BACKLOG",
    priority: input.priority,
    position,
    estimateMinutes: null,
    dueAt: input.dueAt,
    dominantDate: null,
    blockedReason: null,
    dependencyIds: input.dependencyIds,
    steps: input.steps.map((step) => makeStep(step.title, step.status)),
    completionEvidence: [],
    completedAt: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

export function makeEvidence(input: AddEvidenceInput, createdBy: string): EvidenceRecord {
  return {
    id: newId(input.type === "DECISION" ? "decision" : "evidence"),
    projectId: input.projectId,
    taskId: input.taskId,
    type: input.type,
    statement: input.statement,
    sourceRefs: input.sourceRefs,
    confidence: input.confidence,
    implications: input.implications,
    createdBy,
    createdAt: nowIso(),
  };
}

export function makeProposal(input: PrepareProposalInput): DecompositionProposal {
  const at = nowIso();
  return {
    id: newId("proposal"),
    projectId: input.projectId,
    status: "DRAFT",
    sourceRefs: input.sourceRefs,
    assumptions: input.assumptions,
    gaps: input.gaps,
    risks: input.risks,
    capacityCheck: input.capacityCheck,
    changes: input.changes,
    approvedBy: null,
    approvedAt: null,
    appliedAuditId: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}
