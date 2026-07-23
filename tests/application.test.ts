import { beforeEach, describe, expect, it } from "vitest";
import { DeskOsService } from "../src/application/desk-os-service.js";
import type { ActorContext } from "../src/application/context.js";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.js";
import { BlobVaultService } from "../src/lib/vault.js";
import { memoryStore } from "./helpers/memory-store.js";

const actor: ActorContext = { actorType: "ADMIN", actorId: "leonardo", requestId: "req_test" };
let keyCounter = 0;
const key = () => `key_${keyCounter++}`;

function makeService() {
  const store = memoryStore();
  const repos = createDeskOsRepositories(store);
  return { service: new DeskOsService(repos, new BlobVaultService(store)), repos };
}

async function seedProject(service: DeskOsService): Promise<string> {
  const created = await service.createProject(
    { title: "Evoluir MCP", objective: "PM sobre o vault", definitionOfDone: ["Kanban funciona"] },
    key(),
    actor,
  );
  return created.record.id;
}

async function seedSprint(service: DeskOsService, projectId: string): Promise<string> {
  const created = await service.createSprint(
    { projectId, title: "S1", goal: "Núcleo", startDate: "2026-07-20", endDate: "2026-07-24", wipLimit: 1 },
    key(),
    actor,
  );
  return created.record.id;
}

describe("DeskOsService (Gate 3)", () => {
  let service: DeskOsService;

  beforeEach(() => {
    ({ service } = makeService());
  });

  it("reports system status with counts and limits", async () => {
    const status = await service.getSystemStatus();
    expect(status).toMatchObject({ storageAdapter: "vault", stateRoot: "_desk-os/" });
    expect((status.limits as Record<string, unknown>).maxStepsPerTask).toBe(3);
  });

  it("creates and lists projects, and enforces project transitions on update", async () => {
    const projectId = await seedProject(service);
    const listed = await service.listProjects({ query: "mcp" });
    expect(listed).toHaveLength(1);

    await service.updateProject(projectId, { status: "ACTIVE" }, 1, key(), actor);
    await expect(
      service.updateProject(projectId, { status: "IDEA" }, 2, key(), actor),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("builds a kanban board and a Today view from the same canonical state", async () => {
    const projectId = await seedProject(service);
    const sprintId = await seedSprint(service, projectId);
    const task = await service.createTask(
      { projectId, sprintId, title: "Implementar board", outcome: "Board lê índice", steps: [{ title: "colunas" }] },
      key(),
      actor,
    );
    await service.moveTask(
      { taskId: task.record.id, targetStatus: "READY", targetPosition: 1, expectedVersion: 1, idempotencyKey: key() },
      actor,
    );
    await service.moveTask(
      { taskId: task.record.id, targetStatus: "IN_PROGRESS", targetPosition: 1, expectedVersion: 2, idempotencyKey: key() },
      actor,
    );

    const board = await service.getBoard(sprintId);
    const inProgressColumn = (board.columns as Array<{ status: string; tasks: unknown[] }>).find(
      (column) => column.status === "IN_PROGRESS",
    );
    expect(inProgressColumn?.tasks).toHaveLength(1);

    const today = await service.getToday({ date: "2026-07-21" });
    expect((today.nextAction as { id: string }).id).toBe(task.record.id);
  });

  it("enforces the sprint WIP limit on move", async () => {
    const projectId = await seedProject(service);
    const sprintId = await seedSprint(service, projectId);
    const first = await service.createTask(
      { projectId, sprintId, title: "t1", outcome: "o1" },
      key(),
      actor,
    );
    const second = await service.createTask(
      { projectId, sprintId, title: "t2", outcome: "o2" },
      key(),
      actor,
    );
    for (const [task, version] of [
      [first, 1],
      [second, 1],
    ] as const) {
      await service.moveTask(
        { taskId: task.record.id, targetStatus: "READY", targetPosition: 1, expectedVersion: version, idempotencyKey: key() },
        actor,
      );
    }
    await service.moveTask(
      { taskId: first.record.id, targetStatus: "IN_PROGRESS", targetPosition: 1, expectedVersion: 2, idempotencyKey: key() },
      actor,
    );
    await expect(
      service.moveTask(
        { taskId: second.record.id, targetStatus: "IN_PROGRESS", targetPosition: 2, expectedVersion: 2, idempotencyKey: key() },
        actor,
      ),
    ).rejects.toMatchObject({ code: "WIP_LIMIT" });
  });

  it("requires blocked reason and completion evidence on moves", async () => {
    const projectId = await seedProject(service);
    const task = await service.createTask({ projectId, title: "t", outcome: "o" }, key(), actor);
    await service.moveTask(
      { taskId: task.record.id, targetStatus: "READY", targetPosition: 1, expectedVersion: 1, idempotencyKey: key() },
      actor,
    );
    await service.moveTask(
      { taskId: task.record.id, targetStatus: "IN_PROGRESS", targetPosition: 1, expectedVersion: 2, idempotencyKey: key() },
      actor,
    );
    await expect(
      service.moveTask(
        { taskId: task.record.id, targetStatus: "DONE", targetPosition: 1, expectedVersion: 3, idempotencyKey: key() },
        actor,
      ),
    ).rejects.toMatchObject({ code: "COMPLETION_EVIDENCE_REQUIRED" });
    const done = await service.moveTask(
      {
        taskId: task.record.id,
        targetStatus: "DONE",
        targetPosition: 1,
        expectedVersion: 3,
        idempotencyKey: key(),
        completionEvidence: ["evd_x"],
      },
      actor,
    );
    expect(done.record.completedAt).toBeTruthy();
  });

  it("prepares and applies a decomposition proposal with approval, backup and audit", async () => {
    const projectId = await seedProject(service);
    const prepared = await service.prepareDecomposition(
      projectId,
      {
        sourceRefs: ["notes/contexto.md"],
        assumptions: ["capacidade de 15h"],
        gaps: [],
        changes: {
          projectPatch: { status: "ACTIVE" },
          sprintDrafts: [{ title: "S1", goal: "Núcleo", startDate: "2026-07-20", endDate: "2026-07-24" }],
          taskDrafts: [
            { title: "T1", outcome: "O1", steps: [{ title: "s1" }], sprint_ref: 0 },
            { title: "T2", outcome: "O2", sprint_ref: 0 },
          ],
          evidenceDrafts: [
            { type: "DECISION", statement: "Aprovada decomposição inicial", sourceRefs: ["notes/contexto.md"] },
          ],
        },
      },
      key(),
      actor,
    );
    expect(prepared.record.status).toBe("VALIDATED");

    await expect(
      service.applyDecomposition(
        { proposalId: prepared.record.id, expectedVersion: 1, approvedByUser: false, idempotencyKey: key() },
        actor,
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    const applied = await service.applyDecomposition(
      { proposalId: prepared.record.id, expectedVersion: 1, approvedByUser: true, idempotencyKey: key() },
      actor,
    );
    expect(applied.sprintIds).toHaveLength(1);
    expect(applied.taskIds).toHaveLength(2);
    expect(applied.evidenceIds).toHaveLength(1);
    expect(applied.backupRef).toContain("_desk-os/backups/");

    const project = await service.getProject(projectId, ["tasks"]);
    expect((project.project as { status: string }).status).toBe("ACTIVE");
    expect(project.tasks as unknown[]).toHaveLength(2);

    await expect(
      service.applyDecomposition(
        { proposalId: prepared.record.id, expectedVersion: 2, approvedByUser: true, idempotencyKey: key() },
        actor,
      ),
    ).rejects.toMatchObject({ code: "PROPOSAL_ALREADY_APPLIED" });
  });

  it("rejects proposals whose task drafts exceed step limits", async () => {
    const projectId = await seedProject(service);
    await expect(
      service.prepareDecomposition(
        projectId,
        {
          changes: {
            taskDrafts: [{ title: "T", outcome: "O", steps: [{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }] }],
          },
        },
        key(),
        actor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("closes a sprint with a review that records a DECISION", async () => {
    const projectId = await seedProject(service);
    const sprintId = await seedSprint(service, projectId);
    await service.updateSprint(sprintId, { status: "ACTIVE" }, 1, key(), actor);
    const closed = await service.closeSprint(
      {
        sprintId,
        expectedVersion: 2,
        review: { outcome: "Entregue o núcleo", evidence_refs: ["evd_a"], decision: "Seguir para Gate 4" },
        idempotencyKey: key(),
      },
      actor,
    );
    expect(closed.record.status).toBe("COMPLETED");
    expect(closed.decisionId).toMatch(/^dec_/);
  });

  it("searches context across projects, tasks, evidence and notes", async () => {
    const { service: svc } = makeService();
    const projectId = await seedProject(svc);
    await svc.addEvidence(
      { projectId, type: "FACT", statement: "allRecords faz fan-out sequencial", sourceRefs: ["baseline"] },
      key(),
      actor,
    );
    const results = await svc.searchContext({ query: "fan-out" });
    expect(results.some((result) => result.kind === "evidence")).toBe(true);
  });
});
