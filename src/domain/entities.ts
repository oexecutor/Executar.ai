/** Mirrors contracts/domain-model.yaml and contracts/domain-types.ts (v1.0.0). */

export const PROJECT_STATUSES = ["IDEA", "PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export const SPRINT_STATUSES = ["DRAFT", "PLANNED", "ACTIVE", "REVIEW", "COMPLETED", "CANCELLED"] as const;
export const TASK_STATUSES = ["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;
export const PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const EPISTEMIC_TYPES = [
  "FACT",
  "EVIDENCE",
  "INFERENCE",
  "HYPOTHESIS",
  "COUNTEREVIDENCE",
  "GAP",
  "DECISION",
] as const;
export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const STEP_STATUSES = ["TODO", "DOING", "DONE"] as const;
export const PROPOSAL_STATUSES = ["DRAFT", "VALIDATED", "APPROVED", "APPLIED", "REJECTED", "EXPIRED"] as const;
export const ACTOR_TYPES = ["USER", "ADMIN", "MCP_CLIENT", "SYSTEM"] as const;
export const KANBAN_COLUMNS = ["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type SprintStatus = (typeof SPRINT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type EpistemicType = (typeof EPISTEMIC_TYPES)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];

export const DOMAIN_DEFAULTS = {
  maxStepsPerTask: 3,
  maxActiveWorkflows: 1,
  maxDailyDominantDeliveries: 1,
  sprintDays: 5,
} as const;

export interface VersionedEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  maxActiveWorkflows: number;
  maxStepsPerTask: number;
  weekDays: string[];
}

export interface Workspace extends VersionedEntity {
  name: string;
  ownerId: string;
  settings: WorkspaceSettings;
}

export interface Project extends VersionedEntity {
  workspaceId: string;
  title: string;
  objective: string;
  context: string;
  scopeIn: string[];
  scopeOut: string[];
  definitionOfDone: string[];
  status: ProjectStatus;
  priority: Priority;
  ownerId: string;
  startAt: string | null;
  dueAt: string | null;
  tags: string[];
  noteRefs: string[];
  evidenceRefs: string[];
  archivedAt: string | null;
}

export interface Sprint extends VersionedEntity {
  projectId: string;
  title: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  capacityHours: number | null;
  wipLimit: number;
  reviewSummary: string | null;
}

export interface TaskStep {
  id: string;
  title: string;
  status: StepStatus;
}

export interface Task extends VersionedEntity {
  projectId: string;
  sprintId: string | null;
  deliverableId: string | null;
  title: string;
  outcome: string;
  description: string;
  acceptanceCriteria: string[];
  status: TaskStatus;
  priority: Priority;
  position: number;
  estimateMinutes: number | null;
  dueAt: string | null;
  dominantDate: string | null;
  blockedReason: string | null;
  dependencyIds: string[];
  steps: TaskStep[];
  completionEvidence: string[];
  completedAt: string | null;
}

export interface EvidenceRecord {
  id: string;
  projectId: string;
  taskId: string | null;
  type: EpistemicType;
  statement: string;
  sourceRefs: string[];
  confidence: Confidence;
  implications: string;
  createdBy: string;
  createdAt: string;
}

export interface ProposalChanges {
  projectPatch: Record<string, unknown>;
  sprintDrafts: Array<Record<string, unknown>>;
  taskDrafts: Array<Record<string, unknown>>;
  evidenceDrafts: Array<Record<string, unknown>>;
}

export interface DecompositionProposal extends VersionedEntity {
  projectId: string;
  status: ProposalStatus;
  sourceRefs: string[];
  assumptions: string[];
  gaps: string[];
  risks: string[];
  capacityCheck: Record<string, unknown>;
  changes: ProposalChanges;
  approvedBy: string | null;
  approvedAt: string | null;
  appliedAuditId: string | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  idempotencyKey: string | null;
  detail: Record<string, unknown>;
}
