import { z } from "zod";
import { DomainError } from "../domain/errors.js";
import {
  DOMAIN_DEFAULTS,
  EPISTEMIC_TYPES,
  KANBAN_COLUMNS,
  PRIORITIES,
  PROJECT_STATUSES,
  SPRINT_STATUSES,
  TASK_STATUSES,
  type DecompositionProposal,
  type Project,
  type Sprint,
  type Task,
  type TaskStatus,
} from "../domain/entities.js";
import {
  assertActiveWorkflowLimit,
  assertDominantDeliveryLimit,
  assertNoDependencyCycle,
  assertStepLimit,
} from "../domain/capacity.js";
import {
  assertProjectTransition,
  assertSprintTransition,
  assertTaskTransition,
} from "../domain/transitions.js";
import {
  addEvidenceInput,
  createProjectInput,
  createSprintInput,
  createTaskInput,
  prepareProposalInput,
} from "../domain/schemas.js";
import { makeEvidence, makeProject, makeProposal, makeSprint, makeStep, makeTask } from "../domain/factories.js";
import type { DeskOsRepositories } from "../repository/interfaces.js";
import { statePath } from "../repository/paths.js";
import type { BlobVaultService } from "../lib/vault.js";
import { writeOptions, type ActorContext } from "./context.js";

const SCHEMA_VERSION = "1.0.0";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const projectPatch = z
  .object({
    title: z.string().min(1).max(200),
    objective: z.string().min(1),
    context: z.string(),
    scopeIn: z.array(z.string()),
    scopeOut: z.array(z.string()),
    definitionOfDone: z.array(z.string().min(1)).min(1),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PRIORITIES),
    startAt: isoDate.nullable(),
    dueAt: isoDate.nullable(),
    tags: z.array(z.string()),
    noteRefs: z.array(z.string()),
  })
  .partial()
  .strict();

const sprintPatch = z
  .object({
    title: z.string().min(1).max(160),
    goal: z.string().min(1),
    status: z.enum(SPRINT_STATUSES),
    startDate: isoDate,
    endDate: isoDate,
    capacityHours: z.number().min(0).nullable(),
    wipLimit: z.number().int().min(1),
    reviewSummary: z.string().nullable(),
  })
  .partial()
  .strict();

const taskPatch = z
  .object({
    title: z.string().min(1).max(200),
    outcome: z.string().min(1),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    priority: z.enum(PRIORITIES),
    sprintId: z.string().nullable(),
    dueAt: z.string().datetime({ offset: true }).nullable(),
    dominantDate: isoDate.nullable(),
    estimateMinutes: z.number().int().min(0).nullable(),
    blockedReason: z.string().nullable(),
    dependencyIds: z.array(z.string()),
    steps: z.array(z.object({ id: z.string().optional(), title: z.string().min(1).max(160), status: z.enum(["TODO", "DOING", "DONE"]).default("TODO") })),
  })
  .partial()
  .strict();

const taskDraftSchema = createTaskInput.omit({ projectId: true, sprintId: true }).extend({
  sprint_ref: z.number().int().min(0).nullable().default(null),
});

const closeReviewSchema = z.object({
  outcome: z.string().min(1),
  evidence_refs: z.array(z.string()),
  decision: z.string().min(1),
});

function invalid(error: z.ZodError): DomainError {
  const first = error.issues[0];
  return new DomainError(
    "INVALID_INPUT",
    `${first?.path.join(".") || "input"}: ${first?.message ?? "invalid input"}`,
    "Fix the highlighted field and retry.",
    400,
  );
}

function parseWith<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw invalid(result.error);
  return result.data;
}

export class DeskOsService {
  constructor(
    private readonly repos: DeskOsRepositories,
    private readonly vault: BlobVaultService,
  ) {}

  /* ------------------------------- reads -------------------------------- */

  async getSystemStatus(): Promise<Record<string, unknown>> {
    const [projects, sprints, tasks, evidence, proposals] = await Promise.all([
      this.repos.projects.summaries(),
      this.repos.sprints.summaries(),
      this.repos.tasks.summaries(),
      this.repos.evidence.summaries(),
      this.repos.proposals.summaries(),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      storageAdapter: "vault",
      stateRoot: "_desk-os/",
      counts: {
        projects: projects.length,
        sprints: sprints.length,
        tasks: tasks.length,
        evidence: evidence.length,
        proposals: proposals.length,
      },
      limits: DOMAIN_DEFAULTS,
    };
  }

  async listProjects(input: { status?: string[]; query?: string | null; limit?: number } = {}): Promise<Array<Record<string, unknown>>> {
    const statuses = input.status?.length ? new Set(input.status) : null;
    const query = input.query?.toLowerCase() ?? null;
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const summaries = await this.repos.projects.summaries();
    return summaries
      .filter((summary) => !statuses || statuses.has(String(summary.status)))
      .filter((summary) => !query || String(summary.title).toLowerCase().includes(query))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
  }

  async getProject(projectId: string, include: string[] = ["sprints", "tasks", "evidence"]): Promise<Record<string, unknown>> {
    const project = await this.requireProject(projectId);
    const wanted = new Set(include);
    const result: Record<string, unknown> = { project };
    if (wanted.has("sprints")) {
      result.sprints = (await this.repos.sprints.summaries()).filter((s) => s.projectId === projectId);
    }
    if (wanted.has("tasks")) {
      result.tasks = (await this.repos.tasks.summaries()).filter((t) => t.projectId === projectId);
    }
    if (wanted.has("evidence")) {
      result.evidence = (await this.repos.evidence.summaries()).filter((e) => e.projectId === projectId);
    }
    return result;
  }

  async getCurrentSprint(projectId?: string | null): Promise<Record<string, unknown> | null> {
    const sprints = await this.repos.sprints.summaries();
    const candidates = sprints
      .filter((sprint) => !projectId || sprint.projectId === projectId)
      .filter((sprint) => sprint.status === "ACTIVE" || sprint.status === "PLANNED")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
        return String(a.startDate).localeCompare(String(b.startDate));
      });
    return candidates[0] ?? null;
  }

  async getBoard(sprintId: string, includeCompleted = true): Promise<Record<string, unknown>> {
    const sprint = await this.requireSprint(sprintId);
    const tasks = (await this.repos.tasks.summaries()).filter((task) => task.sprintId === sprintId);
    const columns = KANBAN_COLUMNS.filter((column) => includeCompleted || column !== "DONE").map((column) => ({
      status: column,
      tasks: tasks
        .filter((task) => task.status === column)
        .sort((a, b) => Number(a.position) - Number(b.position)),
    }));
    return { sprint: { id: sprint.id, title: sprint.title, goal: sprint.goal, status: sprint.status, wipLimit: sprint.wipLimit }, columns };
  }

  async getToday(input: { date?: string | null; projectId?: string | null } = {}): Promise<Record<string, unknown>> {
    const date = input.date ?? new Date().toISOString().slice(0, 10);
    const sprint = await this.getCurrentSprint(input.projectId ?? null);
    const tasks = (await this.repos.tasks.summaries()).filter(
      (task) =>
        (!input.projectId || task.projectId === input.projectId) &&
        (!sprint || task.sprintId === sprint.id) &&
        task.status !== "CANCELLED",
    );
    const dominant = tasks.find((task) => task.dominantDate === date) ?? null;
    const inProgress = tasks
      .filter((task) => task.status === "IN_PROGRESS")
      .sort((a, b) => Number(a.position) - Number(b.position));
    const ready = tasks
      .filter((task) => task.status === "READY")
      .sort((a, b) => Number(a.position) - Number(b.position));
    const blocked = tasks.filter((task) => task.status === "BLOCKED");
    const nextAction = dominant ?? inProgress[0] ?? ready[0] ?? null;
    return {
      date,
      sprint,
      dominantDelivery: dominant,
      nextAction,
      inProgress,
      ready: ready.slice(0, 5),
      blocked,
      warnings: inProgress.length > 1 ? [`Foco dividido: ${inProgress.length} tarefas em andamento.`] : [],
    };
  }

  async searchContext(input: { query: string; projectId?: string | null; types?: string[]; limit?: number }): Promise<Array<Record<string, unknown>>> {
    const query = input.query?.trim().toLowerCase();
    if (!query) throw new DomainError("INVALID_INPUT", "query must not be empty.", "Provide a search term.", 400);
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const wanted = new Set(input.types?.length ? input.types : ["project", "task", "evidence", "note"]);
    const results: Array<Record<string, unknown>> = [];

    if (wanted.has("project")) {
      for (const summary of await this.repos.projects.summaries()) {
        if (String(summary.title).toLowerCase().includes(query)) results.push({ kind: "project", ...summary });
      }
    }
    if (wanted.has("task")) {
      for (const summary of await this.repos.tasks.summaries()) {
        if (input.projectId && summary.projectId !== input.projectId) continue;
        if (String(summary.title).toLowerCase().includes(query)) results.push({ kind: "task", ...summary });
      }
    }
    if (wanted.has("evidence")) {
      for (const summary of await this.repos.evidence.summaries()) {
        if (input.projectId && summary.projectId !== input.projectId) continue;
        if (String(summary.statement).toLowerCase().includes(query)) results.push({ kind: "evidence", ...summary });
      }
    }
    if (wanted.has("note") && results.length < limit) {
      const noteSearch = (await this.vault.search({ query: input.query, limit: limit - results.length })) as {
        results?: Array<Record<string, unknown>>;
      };
      for (const match of noteSearch.results ?? []) results.push({ kind: "note", ...match });
    }
    return results.slice(0, limit);
  }

  async recentAudit(limit = 50): Promise<Array<Record<string, unknown>>> {
    return this.repos.audit.recent(limit);
  }

  /* ------------------------------- writes ------------------------------- */

  async createProject(rawInput: unknown, idempotencyKey: string, context: ActorContext) {
    const input = parseWith(createProjectInput, rawInput);
    const project = makeProject(input);
    return this.repos.projects.create(project, writeOptions(context, idempotencyKey));
  }

  async updateProject(projectId: string, rawPatch: unknown, expectedVersion: number, idempotencyKey: string, context: ActorContext) {
    const patch = parseWith(projectPatch, rawPatch);
    const current = await this.requireProject(projectId);
    if (patch.status && patch.status !== current.status) {
      assertProjectTransition(current.status, patch.status);
    }
    const next: Project = {
      ...current,
      ...patch,
      archivedAt: patch.status === "ARCHIVED" ? new Date().toISOString() : current.archivedAt,
    };
    return this.repos.projects.update(next, writeOptions(context, idempotencyKey, expectedVersion));
  }

  async createSprint(rawInput: unknown, idempotencyKey: string, context: ActorContext) {
    const input = parseWith(createSprintInput, rawInput);
    await this.requireProject(input.projectId);
    if (input.endDate < input.startDate) {
      throw new DomainError("INVALID_INPUT", "endDate must not be before startDate.", "Swap the dates.", 400);
    }
    return this.repos.sprints.create(makeSprint(input), writeOptions(context, idempotencyKey));
  }

  async updateSprint(sprintId: string, rawPatch: unknown, expectedVersion: number, idempotencyKey: string, context: ActorContext) {
    const patch = parseWith(sprintPatch, rawPatch);
    const current = await this.requireSprint(sprintId);
    if (patch.status && patch.status !== current.status) {
      assertSprintTransition(current.status, patch.status);
      if (patch.status === "ACTIVE") {
        const others = (await this.repos.sprints.summaries()).filter((sprint) => sprint.id !== sprintId);
        assertActiveWorkflowLimit(others as Array<{ id: string; status: Sprint["status"] }>);
      }
    }
    const next: Sprint = { ...current, ...patch };
    return this.repos.sprints.update(next, writeOptions(context, idempotencyKey, expectedVersion));
  }

  async createTask(rawInput: unknown, idempotencyKey: string, context: ActorContext) {
    const input = parseWith(createTaskInput, rawInput);
    await this.requireProject(input.projectId);
    if (input.sprintId) await this.requireSprint(input.sprintId);
    assertStepLimit(input.steps);
    const siblings = (await this.repos.tasks.summaries()).filter((task) => task.projectId === input.projectId);
    if (input.dependencyIds.length > 0) {
      assertNoDependencyCycle([
        ...siblings.map((task) => ({ id: String(task.id), dependencyIds: [] as string[] })),
        { id: "tsk_pending", dependencyIds: input.dependencyIds },
      ]);
    }
    const position = siblings.length + 1;
    return this.repos.tasks.create(makeTask(input, position), writeOptions(context, idempotencyKey));
  }

  async updateTask(taskId: string, rawPatch: unknown, expectedVersion: number, idempotencyKey: string, context: ActorContext) {
    const patch = parseWith(taskPatch, rawPatch);
    const current = await this.requireTask(taskId);
    if (patch.steps) assertStepLimit(patch.steps);
    if (patch.dominantDate) {
      const others = (await this.repos.tasks.summaries()).filter((task) => task.id !== taskId);
      assertDominantDeliveryLimit(
        others as Array<{ id: string; dominantDate: string | null }>,
        patch.dominantDate,
      );
    }
    if (patch.dependencyIds) {
      const others = await this.repos.tasks.summaries();
      assertNoDependencyCycle([
        ...others
          .filter((task) => task.id !== taskId)
          .map((task) => ({ id: String(task.id), dependencyIds: [] as string[] })),
        { id: taskId, dependencyIds: patch.dependencyIds },
      ]);
    }
    const next: Task = {
      ...current,
      ...patch,
      steps: patch.steps
        ? patch.steps.map((step) => (step.id ? { id: step.id, title: step.title, status: step.status } : makeStep(step.title, step.status)))
        : current.steps,
    };
    return this.repos.tasks.update(next, writeOptions(context, idempotencyKey, expectedVersion));
  }

  async moveTask(
    input: {
      taskId: string;
      targetStatus: string;
      targetPosition: number;
      expectedVersion: number;
      idempotencyKey: string;
      blockedReason?: string;
      completionEvidence?: string[];
      overrideReason?: string;
    },
    context: ActorContext,
  ) {
    if (!(TASK_STATUSES as readonly string[]).includes(input.targetStatus)) {
      throw new DomainError("INVALID_INPUT", `Unknown task status: ${input.targetStatus}.`, `Use one of ${TASK_STATUSES.join(", ")}.`, 400);
    }
    const targetStatus = input.targetStatus as TaskStatus;
    const current = await this.requireTask(input.taskId);
    assertTaskTransition(current, targetStatus, {
      blockedReason: input.blockedReason,
      completionEvidence: input.completionEvidence,
      overrideReason: input.overrideReason,
    });
    if (targetStatus === "IN_PROGRESS" && current.sprintId) {
      const sprint = await this.requireSprint(current.sprintId);
      const inProgress = (await this.repos.tasks.summaries()).filter(
        (task) => task.sprintId === current.sprintId && task.status === "IN_PROGRESS" && task.id !== current.id,
      );
      if (inProgress.length >= sprint.wipLimit) {
        throw new DomainError(
          "WIP_LIMIT",
          `Sprint ${sprint.id} already has ${inProgress.length} task(s) in progress (limit ${sprint.wipLimit}).`,
          "Finish or move the current task first.",
          409,
        );
      }
    }
    const next: Task = {
      ...current,
      status: targetStatus,
      position: input.targetPosition,
      blockedReason: targetStatus === "BLOCKED" ? (input.blockedReason ?? current.blockedReason) : null,
      completionEvidence: input.completionEvidence ?? current.completionEvidence,
      completedAt: targetStatus === "DONE" ? new Date().toISOString() : null,
    };
    return this.repos.tasks.update(next, writeOptions(context, input.idempotencyKey, input.expectedVersion));
  }

  async addEvidence(rawInput: unknown, idempotencyKey: string, context: ActorContext) {
    const input = parseWith(addEvidenceInput, rawInput);
    await this.requireProject(input.projectId);
    if (input.taskId) await this.requireTask(input.taskId);
    return this.repos.evidence.create(makeEvidence(input, context.actorId), writeOptions(context, idempotencyKey));
  }

  /* --------------------------- decomposition ---------------------------- */

  async prepareDecomposition(projectId: string, rawProposal: unknown, idempotencyKey: string, context: ActorContext) {
    const input = parseWith(prepareProposalInput, { ...(rawProposal as Record<string, unknown>), projectId });
    await this.requireProject(projectId);

    const warnings: string[] = [];
    const taskDrafts = input.changes.taskDrafts.map((draft) => parseWith(taskDraftSchema, draft));
    for (const draft of taskDrafts) assertStepLimit(draft.steps);
    assertNoDependencyCycle(
      taskDrafts.map((draft, index) => ({ id: `draft_${index}`, dependencyIds: draft.dependencyIds })),
    );
    if (input.gaps.length > 0) warnings.push(`Proposta contém ${input.gaps.length} GAP(s) não resolvidos.`);
    if (taskDrafts.length > 10) warnings.push("Mais de 10 tarefas em uma proposta; considere dividir.");

    const proposal = {
      ...makeProposal(input),
      status: "VALIDATED" as const,
    };
    const result = await this.repos.proposals.create(proposal, writeOptions(context, idempotencyKey));
    return { ...result, warnings };
  }

  /**
   * Destructive boundary (AGENTS.md rule 8): requires explicit user approval,
   * takes a backup first, and is idempotent via the repository receipts.
   */
  async applyDecomposition(
    input: {
      proposalId: string;
      expectedVersion: number;
      approvedByUser: boolean;
      idempotencyKey: string;
      approvalNote?: string | null;
    },
    context: ActorContext,
  ) {
    if (input.approvedByUser !== true) {
      throw new DomainError(
        "APPROVAL_REQUIRED",
        "apply_decomposition requires approved_by_user=true.",
        "Review the proposal with Leonardo and pass the explicit approval flag.",
        403,
      );
    }
    const proposal = await this.requireProposal(input.proposalId);
    if (proposal.status === "APPLIED") {
      throw new DomainError(
        "PROPOSAL_ALREADY_APPLIED",
        `Proposal ${proposal.id} was already applied.`,
        "Prepare a new proposal for further changes.",
        409,
      );
    }
    if (proposal.status !== "VALIDATED" && proposal.status !== "APPROVED") {
      throw new DomainError(
        "PROPOSAL_NOT_READY",
        `Proposal ${proposal.id} is ${proposal.status}.`,
        "Only VALIDATED or APPROVED proposals can be applied.",
        409,
      );
    }
    const project = await this.requireProject(proposal.projectId);

    const backup = await this.repos.backup.backupPaths(
      [statePath("project", project.id), statePath("proposal", proposal.id)],
      `apply-${proposal.id}`,
    );

    const sprintIds: string[] = [];
    for (const draft of proposal.changes.sprintDrafts) {
      const sprintInput = parseWith(createSprintInput, { ...draft, projectId: project.id });
      const created = await this.repos.sprints.create(
        makeSprint(sprintInput),
        writeOptions(context, `${input.idempotencyKey}:sprint:${sprintIds.length}`),
      );
      sprintIds.push(created.record.id);
    }

    const taskIds: string[] = [];
    const siblings = (await this.repos.tasks.summaries()).filter((task) => task.projectId === project.id);
    for (const draft of proposal.changes.taskDrafts) {
      const parsed = parseWith(taskDraftSchema, draft);
      const sprintId = parsed.sprint_ref !== null ? (sprintIds[parsed.sprint_ref] ?? null) : null;
      const taskInput = parseWith(createTaskInput, {
        ...parsed,
        projectId: project.id,
        sprintId,
      });
      const created = await this.repos.tasks.create(
        makeTask(taskInput, siblings.length + taskIds.length + 1),
        writeOptions(context, `${input.idempotencyKey}:task:${taskIds.length}`),
      );
      taskIds.push(created.record.id);
    }

    const evidenceIds: string[] = [];
    for (const draft of proposal.changes.evidenceDrafts) {
      const evidenceInput = parseWith(addEvidenceInput, { ...draft, projectId: project.id });
      const created = await this.repos.evidence.create(
        makeEvidence(evidenceInput, context.actorId),
        writeOptions(context, `${input.idempotencyKey}:evidence:${evidenceIds.length}`),
      );
      evidenceIds.push(created.record.id);
    }

    if (Object.keys(proposal.changes.projectPatch).length > 0) {
      await this.updateProject(
        project.id,
        proposal.changes.projectPatch,
        project.version,
        `${input.idempotencyKey}:project`,
        context,
      );
    }

    const appliedProposal: DecompositionProposal = {
      ...proposal,
      status: "APPLIED",
      approvedBy: context.actorId,
      approvedAt: new Date().toISOString(),
    };
    const result = await this.repos.proposals.update(
      appliedProposal,
      writeOptions(context, `${input.idempotencyKey}:proposal`, input.expectedVersion),
    );

    return {
      proposalId: proposal.id,
      projectId: project.id,
      sprintIds,
      taskIds,
      evidenceIds,
      auditId: result.auditId,
      backupRef: backup.backupRef,
      approvalNote: input.approvalNote ?? null,
    };
  }

  async closeSprint(
    input: { sprintId: string; expectedVersion: number; review: unknown; idempotencyKey: string },
    context: ActorContext,
  ) {
    const review = parseWith(closeReviewSchema, input.review);
    const current = await this.requireSprint(input.sprintId);
    if (current.status === "ACTIVE") assertSprintTransition("ACTIVE", "REVIEW");
    else assertSprintTransition(current.status, "COMPLETED");

    const decision = await this.repos.evidence.create(
      makeEvidence(
        parseWith(addEvidenceInput, {
          projectId: current.projectId,
          type: "DECISION",
          statement: review.decision,
          sourceRefs: review.evidence_refs,
          implications: review.outcome,
        }),
        context.actorId,
      ),
      writeOptions(context, `${input.idempotencyKey}:decision`),
    );

    const next: Sprint = { ...current, status: "COMPLETED", reviewSummary: review.outcome };
    const result = await this.repos.sprints.update(
      next,
      writeOptions(context, input.idempotencyKey, input.expectedVersion),
    );
    return { ...result, decisionId: decision.record.id };
  }

  /* ------------------------------ internal ------------------------------ */

  private async requireProject(id: string): Promise<Project> {
    const record = await this.repos.projects.getById(id);
    if (!record) throw new DomainError("NOT_FOUND", `Project ${id} not found.`, "List projects to find the id.", 404);
    return record;
  }

  private async requireSprint(id: string): Promise<Sprint> {
    const record = await this.repos.sprints.getById(id);
    if (!record) throw new DomainError("NOT_FOUND", `Sprint ${id} not found.`, "List sprints to find the id.", 404);
    return record;
  }

  private async requireTask(id: string): Promise<Task> {
    const record = await this.repos.tasks.getById(id);
    if (!record) throw new DomainError("NOT_FOUND", `Task ${id} not found.`, "Check the board for the id.", 404);
    return record;
  }

  private async requireProposal(id: string): Promise<DecompositionProposal> {
    const record = await this.repos.proposals.getById(id);
    if (!record) throw new DomainError("NOT_FOUND", `Proposal ${id} not found.`, "Prepare a decomposition first.", 404);
    return record;
  }
}

export { EPISTEMIC_TYPES };
