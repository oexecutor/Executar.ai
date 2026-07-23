import { describe, expect, it } from "vitest";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.js";
import { makeEvidence, makeProject, makeSprint, makeTask } from "../src/domain/factories.js";
import { addEvidenceInput, createProjectInput, createSprintInput, createTaskInput } from "../src/domain/schemas.js";
import { BlobVaultService } from "../src/lib/vault.js";
import { memoryStore } from "./helpers/memory-store.js";

function writeOptions(key: string) {
  return { actorId: "leonardo", requestId: `req_${key}`, idempotencyKey: key };
}

function sampleProject() {
  return makeProject(
    createProjectInput.parse({
      title: "Evoluir MCP",
      objective: "PM sobre o vault",
      definitionOfDone: ["Kanban lê o estado canônico"],
    }),
  );
}

describe("desk-os vault repository (Gate 2)", () => {
  it("round-trips create/read/list and keeps records inside _desk-os/", async () => {
    const store = memoryStore();
    const repos = createDeskOsRepositories(store);
    const project = sampleProject();
    const created = await repos.projects.create(project, writeOptions("k1"));
    expect(created.replayed).toBe(false);
    expect(created.auditId).toMatch(/^aud_/);

    expect(await repos.projects.getById(project.id)).toMatchObject({ id: project.id, title: "Evoluir MCP" });
    const summaries = await repos.projects.summaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: project.id, status: "PLANNED" });

    const vault = new BlobVaultService(store);
    const record = await vault.getRecord(`_desk-os/state/projects/${project.id}.json`);
    expect(record.path.startsWith("_desk-os/")).toBe(true);
  });

  it("detects concurrent version conflicts (Gate 2 acceptance)", async () => {
    const repos = createDeskOsRepositories(memoryStore());
    const project = sampleProject();
    await repos.projects.create(project, writeOptions("k1"));
    const updated = await repos.projects.update(
      { ...project, title: "v2" },
      { ...writeOptions("k2"), expectedVersion: 1 },
    );
    expect(updated.record.version).toBe(2);
    await expect(
      repos.projects.update({ ...project, title: "v3" }, { ...writeOptions("k3"), expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT", status: 409 });
  });

  it("does not duplicate records for a replayed idempotency key (Gate 2 acceptance)", async () => {
    const repos = createDeskOsRepositories(memoryStore());
    const project = sampleProject();
    const first = await repos.projects.create(project, writeOptions("same-key"));
    const replay = await repos.projects.create(project, writeOptions("same-key"));
    expect(replay.replayed).toBe(true);
    expect(replay.record.id).toBe(first.record.id);
    expect(await repos.projects.summaries()).toHaveLength(1);

    await expect(
      repos.sprints.create(
        makeSprint(
          createSprintInput.parse({
            projectId: project.id,
            title: "S1",
            goal: "g",
            startDate: "2026-07-20",
            endDate: "2026-07-24",
          }),
        ),
        writeOptions("same-key"),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_REUSE" });
  });

  it("audits every mutation with actor and request ids", async () => {
    const repos = createDeskOsRepositories(memoryStore());
    const project = sampleProject();
    await repos.projects.create(project, writeOptions("k1"));
    await repos.projects.update({ ...project, title: "v2" }, { ...writeOptions("k2"), expectedVersion: 1 });
    const recent = await repos.audit.recent();
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ action: "project.update", entityId: project.id, actorId: "leonardo" });
    expect(recent[1]).toMatchObject({ action: "project.create" });
  });

  it("keeps evidence append-only", async () => {
    const repos = createDeskOsRepositories(memoryStore());
    const project = sampleProject();
    await repos.projects.create(project, writeOptions("k1"));
    const evidence = makeEvidence(
      addEvidenceInput.parse({
        projectId: project.id,
        type: "FACT",
        statement: "allRecords faz um get por arquivo.",
        sourceRefs: ["docs/IMPLEMENTATION_BASELINE.md#4"],
      }),
      "leonardo",
    );
    const created = await repos.evidence.create(evidence, writeOptions("k2"));
    expect(created.record.id).toMatch(/^evd_/);
    expect(() => repos.evidence.update(evidence, writeOptions("k3"))).toThrow(/append-only/);
  });

  it("rebuilds a type index deterministically from state files", async () => {
    const store = memoryStore();
    const repos = createDeskOsRepositories(store);
    const project = sampleProject();
    await repos.projects.create(project, writeOptions("k1"));

    // Simulate a lost/corrupt index and verify recovery from state files.
    // (allowReservedPaths: true — only the repository layer itself gets this.)
    const vault = new BlobVaultService(store, { allowReservedPaths: true });
    await vault.putText("_desk-os/index/projects.json", JSON.stringify({ schemaVersion: "0.0.0" }));
    const summaries = await repos.projects.summaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: project.id });
  });

  it("copies task and sprint state into a labeled backup folder", async () => {
    const store = memoryStore();
    const repos = createDeskOsRepositories(store);
    const project = sampleProject();
    await repos.projects.create(project, writeOptions("k1"));
    const task = makeTask(
      createTaskInput.parse({ projectId: project.id, title: "t", outcome: "o" }),
      1,
    );
    await repos.tasks.create(task, writeOptions("k2"));

    const backup = await repos.backup.backupPaths(
      [`_desk-os/state/projects/${project.id}.json`, `_desk-os/state/tasks/${task.id}.json`, "_desk-os/missing.json"],
      "before apply",
    );
    expect(backup.copied).toBe(2);
    const vault = new BlobVaultService(store);
    const manifest = JSON.parse(
      Buffer.from((await vault.getRecord(`${backup.backupRef}/MANIFEST.json`)).data, "base64").toString("utf8"),
    );
    expect(manifest.copied).toBe(2);
  });
});
