import crypto from "node:crypto";
import { requireAdminJson } from "../src/lib/admin-guard.js";
import { absoluteUrl, json } from "../src/lib/http.js";
import { vaultStore } from "../src/lib/stores.js";
import { BlobVaultService, VaultProblem } from "../src/lib/vault.js";
import { DeskOsService } from "../src/application/desk-os-service.js";
import type { ActorContext } from "../src/application/context.js";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.js";
import { DomainError } from "../src/domain/errors.js";

/**
 * HTTP adapter for contracts/project-management-api.yaml. Thin by design:
 * every route parses the request and calls the same DeskOsService the MCP
 * tools use (AGENTS.md rule 6 — no business rule lives here). Protected by
 * the Gate 0.5 operator session.
 */

interface PmRequest {
  service: DeskOsService;
  context: ActorContext;
  url: URL;
  body: Record<string, unknown>;
}

function ok(data: unknown, requestId: string, auditId: string | null = null, status = 200): Response {
  return json({ ok: true, data, warnings: [], request_id: requestId, audit_id: auditId }, { status });
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}

type Route = (request: PmRequest, params: Record<string, string>) => Promise<Response>;

const routes: Array<{ method: string; pattern: RegExp; names: string[]; handler: Route }> = [];

function route(method: string, path: string, handler: Route): void {
  const names: string[] = [];
  const pattern = new RegExp(
    "^" + path.replaceAll(/:(\w+)/g, (_match, name: string) => {
      names.push(name);
      return "([A-Za-z0-9_-]+)";
    }) + "$",
  );
  routes.push({ method, pattern, names, handler });
}

route("GET", "/status", async ({ service, context }) => ok(await service.getSystemStatus(), context.requestId));

route("GET", "/projects", async ({ service, context, url }) =>
  ok(
    await service.listProjects({
      status: url.searchParams.getAll("status"),
      query: url.searchParams.get("query"),
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    context.requestId,
  ));

route("POST", "/projects", async ({ service, context, body }) => {
  const result = await service.createProject(body.project ?? body, str(body.idempotency_key), context);
  return ok(result.record, context.requestId, result.auditId, 201);
});

route("GET", "/projects/:projectId", async ({ service, context, url }, params) =>
  ok(
    await service.getProject(
      params.projectId ?? "",
      url.searchParams.has("include") ? url.searchParams.getAll("include") : undefined,
    ),
    context.requestId,
  ));

route("PATCH", "/projects/:projectId", async ({ service, context, body }, params) => {
  const result = await service.updateProject(
    params.projectId ?? "",
    body.patch ?? {},
    num(body.expected_version),
    str(body.idempotency_key),
    context,
  );
  return ok(result.record, context.requestId, result.auditId);
});

route("POST", "/projects/:projectId/evidence", async ({ service, context, body }, params) => {
  const result = await service.addEvidence(
    { ...(body.evidence as Record<string, unknown> ?? body), projectId: params.projectId },
    str(body.idempotency_key),
    context,
  );
  return ok(result.record, context.requestId, result.auditId, 201);
});

route("POST", "/sprints", async ({ service, context, body }) => {
  const result = await service.createSprint(body.sprint ?? body, str(body.idempotency_key), context);
  return ok(result.record, context.requestId, result.auditId, 201);
});

route("GET", "/sprints/current", async ({ service, context, url }) =>
  ok(await service.getCurrentSprint(url.searchParams.get("project_id")), context.requestId));

route("GET", "/sprints/:sprintId", async ({ service, context }, params) => {
  const board = await service.getBoard(params.sprintId ?? "");
  return ok(board.sprint, context.requestId);
});

route("PATCH", "/sprints/:sprintId", async ({ service, context, body }, params) => {
  const result = await service.updateSprint(
    params.sprintId ?? "",
    body.patch ?? {},
    num(body.expected_version),
    str(body.idempotency_key),
    context,
  );
  return ok(result.record, context.requestId, result.auditId);
});

route("GET", "/sprints/:sprintId/board", async ({ service, context, url }, params) =>
  ok(
    await service.getBoard(params.sprintId ?? "", url.searchParams.get("include_completed") !== "false"),
    context.requestId,
  ));

route("POST", "/sprints/:sprintId/close", async ({ service, context, body }, params) => {
  const result = await service.closeSprint(
    {
      sprintId: params.sprintId ?? "",
      expectedVersion: num(body.expected_version),
      review: body.review,
      idempotencyKey: str(body.idempotency_key),
    },
    context,
  );
  return ok({ sprint: result.record, decisionId: result.decisionId }, context.requestId, result.auditId);
});

route("POST", "/tasks", async ({ service, context, body }) => {
  const result = await service.createTask(body.task ?? body, str(body.idempotency_key), context);
  return ok(result.record, context.requestId, result.auditId, 201);
});

route("PATCH", "/tasks/:taskId", async ({ service, context, body }, params) => {
  const result = await service.updateTask(
    params.taskId ?? "",
    body.patch ?? {},
    num(body.expected_version),
    str(body.idempotency_key),
    context,
  );
  return ok(result.record, context.requestId, result.auditId);
});

route("POST", "/tasks/:taskId/move", async ({ service, context, body }, params) => {
  const result = await service.moveTask(
    {
      taskId: params.taskId ?? "",
      targetStatus: str(body.target_status),
      targetPosition: num(body.target_position),
      expectedVersion: num(body.expected_version),
      idempotencyKey: str(body.idempotency_key),
      blockedReason: typeof body.blocked_reason === "string" ? body.blocked_reason : undefined,
      completionEvidence: Array.isArray(body.completion_evidence) ? (body.completion_evidence as string[]) : undefined,
      overrideReason: typeof body.override_reason === "string" ? body.override_reason : undefined,
    },
    context,
  );
  return ok(result.record, context.requestId, result.auditId);
});

route("GET", "/today", async ({ service, context, url }) =>
  ok(
    await service.getToday({ date: url.searchParams.get("date"), projectId: url.searchParams.get("project_id") }),
    context.requestId,
  ));

route("GET", "/context/search", async ({ service, context, url }) =>
  ok(
    await service.searchContext({
      query: url.searchParams.get("query") ?? "",
      projectId: url.searchParams.get("project_id"),
      types: url.searchParams.has("types") ? url.searchParams.getAll("types") : undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    context.requestId,
  ));

route("GET", "/audit", async ({ service, context, url }) =>
  ok(
    await service.recentAudit(url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 50),
    context.requestId,
  ));

route("POST", "/decomposition/proposals", async ({ service, context, body }) => {
  const result = await service.prepareDecomposition(
    str(body.project_id),
    body.proposal ?? {},
    str(body.idempotency_key),
    context,
  );
  return ok(result.record, context.requestId, result.auditId, 201);
});

route("POST", "/decomposition/proposals/:proposalId/apply", async ({ service, context, body }, params) => {
  const result = await service.applyDecomposition(
    {
      proposalId: params.proposalId ?? "",
      expectedVersion: num(body.expected_version),
      approvedByUser: body.approved_by_user === true,
      idempotencyKey: str(body.idempotency_key),
      approvalNote: typeof body.approval_note === "string" ? body.approval_note : null,
    },
    context,
  );
  return ok(result, context.requestId, result.auditId);
});

function defaultService(): DeskOsService {
  const store = vaultStore();
  return new DeskOsService(createDeskOsRepositories(store), new BlobVaultService(store));
}

let serviceFactory: () => DeskOsService = defaultService;

/** Tests inject an in-memory service; production uses Vercel Postgres. */
export function setPmServiceForTesting(factory: (() => DeskOsService) | null): void {
  serviceFactory = factory ?? defaultService;
}

export default async (request: Request): Promise<Response> => {
  const denied = await requireAdminJson(request);
  if (denied) return denied;

  const requestId = `req_${crypto.randomUUID()}`;
  const url = absoluteUrl(request);
  const subPath = url.pathname.replace(/^\/api\/pm/, "") || "/";

  try {
    const body =
      request.method === "GET"
        ? {}
        : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
    const service = serviceFactory();
    const context: ActorContext = { actorType: "ADMIN", actorId: "operator", requestId };

    for (const candidate of routes) {
      if (candidate.method !== request.method) continue;
      const match = subPath.match(candidate.pattern);
      if (!match) continue;
      const params: Record<string, string> = {};
      candidate.names.forEach((name, index) => {
        params[name] = match[index + 1] ?? "";
      });
      return await candidate.handler({ service, context, url, body }, params);
    }
    return json(
      { ok: false, error: { code: "NOT_FOUND", message: `No PM route for ${request.method} ${subPath}.` }, request_id: requestId },
      { status: 404 },
    );
  } catch (error) {
    if (error instanceof DomainError || error instanceof VaultProblem) {
      const status = error instanceof DomainError ? error.status : 400;
      return json(
        {
          ok: false,
          error: { code: error.code, message: error.message, suggestion: error.suggestion },
          request_id: requestId,
        },
        { status },
      );
    }
    console.error(error instanceof Error ? error.message : String(error));
    return json(
      { ok: false, error: { code: "SERVER_ERROR", message: "Erro inesperado na API PM." }, request_id: requestId },
      { status: 500 },
    );
  }
};
