import { DomainError } from "./errors.js";
import { DOMAIN_DEFAULTS } from "./entities.js";
import type { Sprint, Task, TaskStep } from "./entities.js";

export function assertStepLimit(steps: readonly unknown[] | readonly TaskStep[], max = DOMAIN_DEFAULTS.maxStepsPerTask): void {
  if (steps.length > max) {
    throw new DomainError(
      "TOO_MANY_STEPS",
      `A task may have at most ${max} visible steps (got ${steps.length}).`,
      "Split the extra work into another task.",
    );
  }
}

/** One active workflow by default: at most N sprints in ACTIVE at once. */
export function assertActiveWorkflowLimit(
  activeSprints: readonly Pick<Sprint, "id" | "status">[],
  max = DOMAIN_DEFAULTS.maxActiveWorkflows,
): void {
  const active = activeSprints.filter((sprint) => sprint.status === "ACTIVE");
  if (active.length >= max) {
    throw new DomainError(
      "ACTIVE_WORKFLOW_LIMIT",
      `Only ${max} active sprint(s) allowed; ${active.map((s) => s.id).join(", ")} is already active.`,
      "Close or cancel the current sprint before activating another.",
      409,
    );
  }
}

/** One dominant delivery visible per day. */
export function assertDominantDeliveryLimit(
  tasks: readonly Pick<Task, "id" | "dominantDate">[],
  date: string,
  max = DOMAIN_DEFAULTS.maxDailyDominantDeliveries,
): void {
  const dominant = tasks.filter((task) => task.dominantDate === date);
  if (dominant.length >= max) {
    throw new DomainError(
      "DOMINANT_DELIVERY_LIMIT",
      `Only ${max} dominant delivery is allowed on ${date}.`,
      "Move the other dominant task to a different day first.",
      409,
    );
  }
}

/**
 * PM-105: reject dependency graphs with cycles. Returns the first cycle found
 * as a list of task IDs, or null when the graph is acyclic.
 */
export function findDependencyCycle(
  tasks: readonly Pick<Task, "id" | "dependencyIds">[],
): string[] | null {
  const graph = new Map(tasks.map((task) => [task.id, task.dependencyIds]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    if (done.has(id)) return null;
    if (visiting.has(id)) return stack.slice(stack.indexOf(id)).concat(id);
    visiting.add(id);
    stack.push(id);
    for (const dependency of graph.get(id) ?? []) {
      if (!graph.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    done.add(id);
    return null;
  }

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return null;
}

export function assertNoDependencyCycle(tasks: readonly Pick<Task, "id" | "dependencyIds">[]): void {
  const cycle = findDependencyCycle(tasks);
  if (cycle) {
    throw new DomainError(
      "DEPENDENCY_CYCLE",
      `Task dependencies form a cycle: ${cycle.join(" -> ")}.`,
      "Remove one dependency from the cycle before applying.",
      409,
    );
  }
}
