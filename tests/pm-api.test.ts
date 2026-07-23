import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pmHandler, { setPmServiceForTesting } from "../api/pm.js";
import { adminCookie, signAdminSession } from "../src/lib/auth.mjs";
import { DeskOsService } from "../src/application/desk-os-service.mjs";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.mjs";
import { BlobVaultService } from "../src/lib/vault.mjs";
import { memoryStore } from "./helpers/memory-store.js";

const BASE = "https://example.test/api/pm";

let cookie = "";

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  return pmHandler(
    new Request(`${BASE}${path}`, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function data<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { ok: boolean; data: T };
  expect(payload.ok).toBe(true);
  return payload.data;
}

beforeEach(async () => {
  vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery");
  const store = memoryStore();
  setPmServiceForTesting(() => new DeskOsService(createDeskOsRepositories(store), new BlobVaultService(store)));
  cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
});

afterEach(() => {
  setPmServiceForTesting(null);
  vi.unstubAllEnvs();
});

describe("/api/pm HTTP adapter (Gate 5, API half)", () => {
  it("requires the operator session", async () => {
    const response = await pmHandler(new Request(`${BASE}/status`));
    expect(response.status).toBe(401);
  });

  it("serves system status and 404s unknown routes", async () => {
    const status = await call("GET", "/status");
    expect(status.status).toBe(200);
    expect(await data<{ storageAdapter: string }>(status)).toMatchObject({ storageAdapter: "vault" });
    expect((await call("GET", "/nope")).status).toBe(404);
  });

  it("runs the project -> sprint -> task -> board cycle over HTTP", async () => {
    const project = await data<{ id: string }>(
      await call("POST", "/projects", {
        idempotency_key: "k1",
        title: "Evoluir MCP",
        objective: "PM sobre o vault",
        definitionOfDone: ["Kanban funciona"],
      }),
    );

    const sprint = await data<{ id: string }>(
      await call("POST", "/sprints", {
        idempotency_key: "k2",
        projectId: project.id,
        title: "S1",
        goal: "Núcleo",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
      }),
    );

    const task = await data<{ id: string; version: number }>(
      await call("POST", "/tasks", {
        idempotency_key: "k3",
        projectId: project.id,
        sprintId: sprint.id,
        title: "Implementar board",
        outcome: "Board lê o índice",
        steps: [{ title: "colunas" }],
      }),
    );

    const moved = await call("POST", `/tasks/${task.id}/move`, {
      idempotency_key: "k4",
      target_status: "READY",
      target_position: 1,
      expected_version: 1,
    });
    expect(moved.status).toBe(200);

    const board = await data<{ columns: Array<{ status: string; tasks: unknown[] }> }>(
      await call("GET", `/sprints/${sprint.id}/board`),
    );
    expect(board.columns.find((column) => column.status === "READY")?.tasks).toHaveLength(1);

    const today = await data<{ nextAction: { id: string } | null }>(await call("GET", "/today?date=2026-07-21"));
    expect(today.nextAction?.id).toBe(task.id);

    const audit = await data<unknown[]>(await call("GET", "/audit"));
    expect(audit.length).toBeGreaterThanOrEqual(4);
  });

  it("returns typed domain errors with contract shape", async () => {
    const response = await call("POST", "/tasks/tsk_missing/move", {
      idempotency_key: "k1",
      target_status: "READY",
      target_position: 1,
      expected_version: 1,
    });
    expect(response.status).toBe(404);
    const payload = (await response.json()) as { ok: boolean; error: { code: string }; request_id: string };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(payload.request_id).toMatch(/^req_/);
  });

  it("refuses to apply an unapproved decomposition over HTTP too", async () => {
    const project = await data<{ id: string }>(
      await call("POST", "/projects", {
        idempotency_key: "k1",
        title: "P",
        objective: "o",
        definitionOfDone: ["d"],
      }),
    );
    const proposal = await data<{ id: string }>(
      await call("POST", "/decomposition/proposals", {
        idempotency_key: "k2",
        project_id: project.id,
        proposal: { changes: { taskDrafts: [{ title: "T", outcome: "O" }] } },
      }),
    );
    const denied = await call("POST", `/decomposition/proposals/${proposal.id}/apply`, {
      idempotency_key: "k3",
      expected_version: 1,
      approved_by_user: false,
    });
    expect(denied.status).toBe(403);
  });
});
