import { DomainError } from "./errors.js";
import type { ProjectStatus, SprintStatus, Task, TaskStatus } from "./entities.js";

const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  IDEA: ["PLANNED", "ARCHIVED"],
  PLANNED: ["ACTIVE", "ON_HOLD", "ARCHIVED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "ARCHIVED"],
  ON_HOLD: ["ACTIVE", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

const SPRINT_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["REVIEW", "CANCELLED"],
  REVIEW: ["COMPLETED", "ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ["READY", "CANCELLED"],
  READY: ["IN_PROGRESS", "BACKLOG", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "READY", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "READY", "CANCELLED"],
  DONE: ["READY"],
  CANCELLED: [],
};

function assertTransition<S extends string>(
  entity: string,
  table: Record<S, S[]>,
  from: S,
  to: S,
): void {
  if (from === to) return;
  const allowed = table[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `${entity} cannot move from ${from} to ${to}.`,
      allowed.length > 0 ? `Allowed transitions from ${from}: ${allowed.join(", ")}.` : `${from} is a terminal status.`,
      409,
    );
  }
}

export function assertProjectTransition(from: ProjectStatus, to: ProjectStatus): void {
  assertTransition("Project", PROJECT_TRANSITIONS, from, to);
}

export function assertSprintTransition(from: SprintStatus, to: SprintStatus): void {
  assertTransition("Sprint", SPRINT_TRANSITIONS, from, to);
}

/**
 * Task transitions carry the contract's field constraints:
 * BLOCKED requires blocked_reason; DONE requires completion evidence or an
 * explicit override reason (contracts/domain-model.yaml Task.constraints).
 */
export function assertTaskTransition(
  task: Pick<Task, "status" | "blockedReason" | "completionEvidence">,
  to: TaskStatus,
  options: { blockedReason?: string; completionEvidence?: string[]; overrideReason?: string } = {},
): void {
  assertTransition("Task", TASK_TRANSITIONS, task.status, to);
  if (to === "BLOCKED" && !(options.blockedReason ?? task.blockedReason)?.trim()) {
    throw new DomainError(
      "BLOCKED_REASON_REQUIRED",
      "Moving a task to BLOCKED requires a blocked_reason.",
      "Explain what is blocking the task.",
    );
  }
  if (to === "DONE") {
    const evidence = options.completionEvidence ?? task.completionEvidence;
    if ((evidence?.length ?? 0) === 0 && !options.overrideReason?.trim()) {
      throw new DomainError(
        "COMPLETION_EVIDENCE_REQUIRED",
        "Completing a task requires completion evidence or an explicit override reason.",
        "Attach evidence refs, or pass an override reason acknowledging the gap.",
      );
    }
  }
}
