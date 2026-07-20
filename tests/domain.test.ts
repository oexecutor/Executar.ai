import { describe, expect, it } from "vitest";
import {
  assertActiveWorkflowLimit,
  assertDominantDeliveryLimit,
  assertNoDependencyCycle,
  assertStepLimit,
  findDependencyCycle,
} from "../src/domain/capacity.mjs";
import { DomainError } from "../src/domain/errors.mjs";
import { isEntityId, newId } from "../src/domain/ids.mjs";
import {
  assertProjectTransition,
  assertSprintTransition,
  assertTaskTransition,
} from "../src/domain/transitions.mjs";
import { addEvidenceInput, createProjectInput, createTaskInput, projectSchema } from "../src/domain/schemas.mjs";
import { makeProject, makeTask } from "../src/domain/factories.mjs";

describe("ids", () => {
  it("generates prefixed ids and validates both generated and contract ids", () => {
    expect(newId("project")).toMatch(/^prj_[0-9a-f]{16}$/);
    expect(isEntityId(newId("task"), "task")).toBe(true);
    expect(isEntityId("prj_desk_os_mcp", "project")).toBe(true);
    expect(isEntityId("prj_desk_os_mcp", "sprint")).toBe(false);
    expect(isEntityId("garbage", undefined)).toBe(false);
  });
});

describe("status transitions (Gate 1 acceptance: invalid transitions fail)", () => {
  it("allows contract-valid project moves and rejects invalid ones", () => {
    expect(() => assertProjectTransition("IDEA", "PLANNED")).not.toThrow();
    expect(() => assertProjectTransition("ACTIVE", "COMPLETED")).not.toThrow();
    expect(() => assertProjectTransition("IDEA", "COMPLETED")).toThrow(DomainError);
    expect(() => assertProjectTransition("ARCHIVED", "ACTIVE")).toThrow(DomainError);
  });

  it("allows contract-valid sprint moves and rejects invalid ones", () => {
    expect(() => assertSprintTransition("DRAFT", "PLANNED")).not.toThrow();
    expect(() => assertSprintTransition("ACTIVE", "REVIEW")).not.toThrow();
    expect(() => assertSprintTransition("DRAFT", "ACTIVE")).toThrow(DomainError);
    expect(() => assertSprintTransition("COMPLETED", "ACTIVE")).toThrow(DomainError);
  });

  it("enforces task-level constraints on BLOCKED and DONE", () => {
    const task = {
      status: "IN_PROGRESS" as const,
      blockedReason: null,
      completionEvidence: [] as string[],
    };
    expect(() => assertTaskTransition(task, "BLOCKED")).toThrow(/blocked_reason/);
    expect(() => assertTaskTransition(task, "BLOCKED", { blockedReason: "waiting api key" })).not.toThrow();
    expect(() => assertTaskTransition(task, "DONE")).toThrow(/evidence/);
    expect(() => assertTaskTransition(task, "DONE", { completionEvidence: ["evd_1"] })).not.toThrow();
    expect(() => assertTaskTransition(task, "DONE", { overrideReason: "trivial chore" })).not.toThrow();
    expect(() => assertTaskTransition({ ...task, status: "BACKLOG" }, "DONE")).toThrow(DomainError);
  });
});

describe("capacity rules", () => {
  it("rejects more than three steps (Gate 1 acceptance)", () => {
    expect(() => assertStepLimit([1, 2, 3])).not.toThrow();
    expect(() => assertStepLimit([1, 2, 3, 4])).toThrow(/at most 3/);
  });

  it("enforces one active workflow and one dominant delivery per day", () => {
    expect(() =>
      assertActiveWorkflowLimit([{ id: "spr_a", status: "ACTIVE" }]),
    ).toThrow(DomainError);
    expect(() =>
      assertActiveWorkflowLimit([{ id: "spr_a", status: "COMPLETED" }]),
    ).not.toThrow();
    expect(() =>
      assertDominantDeliveryLimit([{ id: "tsk_a", dominantDate: "2026-07-20" }], "2026-07-20"),
    ).toThrow(DomainError);
    expect(() =>
      assertDominantDeliveryLimit([{ id: "tsk_a", dominantDate: "2026-07-19" }], "2026-07-20"),
    ).not.toThrow();
  });

  it("detects dependency cycles (PM-105)", () => {
    const acyclic = [
      { id: "tsk_a", dependencyIds: ["tsk_b"] },
      { id: "tsk_b", dependencyIds: [] },
    ];
    expect(findDependencyCycle(acyclic)).toBeNull();
    const cyclic = [
      { id: "tsk_a", dependencyIds: ["tsk_b"] },
      { id: "tsk_b", dependencyIds: ["tsk_c"] },
      { id: "tsk_c", dependencyIds: ["tsk_a"] },
    ];
    expect(findDependencyCycle(cyclic)).toContain("tsk_a");
    expect(() => assertNoDependencyCycle(cyclic)).toThrow(/cycle/);
  });
});

describe("schemas and factories", () => {
  it("validates the evidence taxonomy (Gate 1 acceptance)", () => {
    const valid = addEvidenceInput.safeParse({
      projectId: "prj_desk_os_mcp",
      type: "COUNTEREVIDENCE",
      statement: "Latency regressed after enabling the index.",
      sourceRefs: ["notes/perf.md"],
    });
    expect(valid.success).toBe(true);
    const invalid = addEvidenceInput.safeParse({
      projectId: "prj_desk_os_mcp",
      type: "OPINION",
      statement: "x",
    });
    expect(invalid.success).toBe(false);
  });

  it("builds contract-valid entities from creation inputs", () => {
    const projectInput = createProjectInput.parse({
      title: "Evoluir MCP",
      objective: "PM sobre o vault",
      definitionOfDone: ["Kanban lê e escreve o estado canônico"],
    });
    const project = makeProject(projectInput);
    expect(projectSchema.parse(project)).toBeTruthy();
    expect(project.status).toBe("PLANNED");
    expect(project.version).toBe(1);

    const taskInput = createTaskInput.parse({
      projectId: project.id,
      title: "Implementar board",
      outcome: "Board renderiza colunas do contrato",
      steps: [{ title: "Definir colunas" }, { title: "Ler índice" }, { title: "Renderizar" }],
    });
    const task = makeTask(taskInput, 1);
    expect(task.steps).toHaveLength(3);
    expect(task.steps.every((step) => step.id.startsWith("stp_"))).toBe(true);
    expect(task.status).toBe("BACKLOG");
  });

  it("rejects a creation input with more than three steps", () => {
    const result = createTaskInput.safeParse({
      projectId: "prj_x",
      title: "t",
      outcome: "o",
      steps: [{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }],
    });
    expect(result.success).toBe(false);
  });
});
