import { z } from "zod";
import {
  CONFIDENCE_LEVELS,
  DOMAIN_DEFAULTS,
  EPISTEMIC_TYPES,
  PRIORITIES,
  PROJECT_STATUSES,
  PROPOSAL_STATUSES,
  SPRINT_STATUSES,
  STEP_STATUSES,
  TASK_STATUSES,
} from "./entities.mjs";

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`));

export const versionedFields = {
  version: z.number().int().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

export const stepSchema = z.object({
  id: id("stp"),
  title: z.string().min(1).max(160),
  status: z.enum(STEP_STATUSES),
});

export const projectSchema = z.object({
  id: id("prj"),
  workspaceId: id("wsp"),
  title: z.string().min(1).max(200),
  objective: z.string().min(1),
  context: z.string().default(""),
  scopeIn: z.array(z.string()).default([]),
  scopeOut: z.array(z.string()).default([]),
  definitionOfDone: z.array(z.string()).min(1),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES),
  ownerId: z.string().default(""),
  startAt: isoDate.nullable().default(null),
  dueAt: isoDate.nullable().default(null),
  tags: z.array(z.string()).default([]),
  noteRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  archivedAt: isoDateTime.nullable().default(null),
  ...versionedFields,
});

export const sprintSchema = z.object({
  id: id("spr"),
  projectId: id("prj"),
  title: z.string().min(1).max(160),
  goal: z.string().min(1),
  status: z.enum(SPRINT_STATUSES),
  startDate: isoDate,
  endDate: isoDate,
  capacityHours: z.number().min(0).nullable().default(null),
  wipLimit: z.number().int().min(1).default(1),
  reviewSummary: z.string().nullable().default(null),
  ...versionedFields,
});

export const taskSchema = z.object({
  id: id("tsk"),
  projectId: id("prj"),
  sprintId: id("spr").nullable().default(null),
  deliverableId: id("del").nullable().default(null),
  title: z.string().min(1).max(200),
  outcome: z.string().min(1),
  description: z.string().default(""),
  acceptanceCriteria: z.array(z.string()).default([]),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  position: z.number(),
  estimateMinutes: z.number().int().min(0).nullable().default(null),
  dueAt: isoDateTime.nullable().default(null),
  dominantDate: isoDate.nullable().default(null),
  blockedReason: z.string().nullable().default(null),
  dependencyIds: z.array(z.string()).default([]),
  steps: z.array(stepSchema).max(DOMAIN_DEFAULTS.maxStepsPerTask),
  completionEvidence: z.array(z.string()).default([]),
  completedAt: isoDateTime.nullable().default(null),
  ...versionedFields,
});

export const evidenceSchema = z.object({
  id: z.string().regex(/^(evd|dec)_[A-Za-z0-9_-]+$/),
  projectId: id("prj"),
  taskId: id("tsk").nullable().default(null),
  type: z.enum(EPISTEMIC_TYPES),
  statement: z.string().min(1),
  sourceRefs: z.array(z.string()),
  confidence: z.enum(CONFIDENCE_LEVELS),
  implications: z.string().default(""),
  createdBy: z.string().default(""),
  createdAt: isoDateTime,
});

export const proposalSchema = z.object({
  id: id("prop"),
  projectId: id("prj"),
  status: z.enum(PROPOSAL_STATUSES),
  sourceRefs: z.array(z.string()),
  assumptions: z.array(z.string()),
  gaps: z.array(z.string()),
  risks: z.array(z.string()).default([]),
  capacityCheck: z.record(z.unknown()).default({}),
  changes: z.object({
    projectPatch: z.record(z.unknown()).default({}),
    sprintDrafts: z.array(z.record(z.unknown())).default([]),
    taskDrafts: z.array(z.record(z.unknown())).default([]),
    evidenceDrafts: z.array(z.record(z.unknown())).default([]),
  }),
  approvedBy: z.string().nullable().default(null),
  approvedAt: isoDateTime.nullable().default(null),
  appliedAuditId: z.string().nullable().default(null),
  ...versionedFields,
});

/* ---------------------------- creation inputs ---------------------------- */

export const createProjectInput = z.object({
  title: z.string().min(1).max(200),
  objective: z.string().min(1),
  definitionOfDone: z.array(z.string().min(1)).min(1),
  context: z.string().default(""),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  scopeIn: z.array(z.string()).default([]),
  scopeOut: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  noteRefs: z.array(z.string()).default([]),
});

export const createSprintInput = z.object({
  projectId: id("prj"),
  title: z.string().min(1).max(160),
  goal: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  capacityHours: z.number().min(0).nullable().default(null),
  wipLimit: z.number().int().min(1).default(1),
});

export const createTaskStepInput = z.object({
  title: z.string().min(1).max(160),
  status: z.enum(STEP_STATUSES).default("TODO"),
});

export const createTaskInput = z.object({
  projectId: id("prj"),
  sprintId: id("spr").nullable().default(null),
  title: z.string().min(1).max(200),
  outcome: z.string().min(1),
  description: z.string().default(""),
  acceptanceCriteria: z.array(z.string()).default([]),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  steps: z.array(createTaskStepInput).max(DOMAIN_DEFAULTS.maxStepsPerTask).default([]),
  dependencyIds: z.array(z.string()).default([]),
  dueAt: isoDateTime.nullable().default(null),
});

export const addEvidenceInput = z.object({
  projectId: id("prj"),
  taskId: id("tsk").nullable().default(null),
  type: z.enum(EPISTEMIC_TYPES),
  statement: z.string().min(1),
  sourceRefs: z.array(z.string()).default([]),
  confidence: z.enum(CONFIDENCE_LEVELS).default("MEDIUM"),
  implications: z.string().default(""),
});

export const prepareProposalInput = z.object({
  projectId: id("prj"),
  sourceRefs: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  capacityCheck: z.record(z.unknown()).default({}),
  changes: z.object({
    projectPatch: z.record(z.unknown()).default({}),
    sprintDrafts: z.array(z.record(z.unknown())).default([]),
    taskDrafts: z.array(z.record(z.unknown())).default([]),
    evidenceDrafts: z.array(z.record(z.unknown())).default([]),
  }),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;
export type CreateSprintInput = z.infer<typeof createSprintInput>;
export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type AddEvidenceInput = z.infer<typeof addEvidenceInput>;
export type PrepareProposalInput = z.infer<typeof prepareProposalInput>;
