import crypto from "node:crypto";
import { DomainError } from "../src/domain/errors.js";
import { ExecutarService } from "../src/executar/service.js";
import { ExecutarStore } from "../src/executar/store.js";
import { requireAdminJson } from "../src/lib/admin-guard.js";
import { absoluteUrl, json } from "../src/lib/http.js";
import { getAuthenticatedRequest, type AuthenticatedRequest } from "../src/lib/request-auth.js";
import { vaultStore } from "../src/lib/stores.js";

function response(data: unknown, requestId: string, status = 200): Response {
  return json(
    { ok: true, data, warnings: [], request_id: requestId },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization, Cookie, X-Workspace-Id",
      },
    },
  );
}

function defaultService(auth: AuthenticatedRequest): ExecutarService {
  return new ExecutarService(
    new ExecutarStore(vaultStore({ workspaceId: auth.workspaceId, accessToken: auth.accessToken })),
  );
}

let serviceFactory: (auth: AuthenticatedRequest) => ExecutarService = defaultService;

export function setExecutarServiceForTesting(factory: (() => ExecutarService) | null): void {
  serviceFactory = factory ?? defaultService;
}

function canWrite(auth: AuthenticatedRequest): boolean {
  return auth.role !== "VIEWER";
}

export default async (request: Request): Promise<Response> => {
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  const auth = await getAuthenticatedRequest(request);
  if (!auth) return json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sessão inválida." } }, { status: 401 });

  const requestId = `req_${crypto.randomUUID()}`;
  const url = absoluteUrl(request);
  const path = url.pathname.replace(/^\/api\/executar/, "") || "/";
  const service = serviceFactory(auth);

  try {
    const body = request.method === "GET"
      ? {}
      : await request.json().catch(() => ({})) as Record<string, unknown>;

    if (request.method === "GET" && path === "/projects") {
      return response(await service.listProjects(), requestId);
    }
    if (request.method === "POST" && path === "/validate") {
      return response(service.validate(body.project ?? body), requestId);
    }
    if (request.method === "POST" && path === "/projects") {
      if (!canWrite(auth)) throw new DomainError("FORBIDDEN", "Seu perfil é somente leitura.", "Solicite a função EDITOR ou superior.", 403);
      return response(await service.createProject({
        project: body.project,
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        owner: typeof body.owner === "string" ? body.owner : undefined,
      }), requestId, 201);
    }

    const match = path.match(/^\/projects\/(PRJ-[A-Za-z0-9-]+)(?:\/(status|next|export|actions|checkpoints|reset))?(?:\/([A-Za-z0-9.-]+))?$/);
    if (match) {
      const projectId = match[1] ?? "";
      const operation = match[2];
      const entityId = match[3];
      if (request.method === "GET" && !operation) return response(await service.getProject(projectId), requestId);
      if (request.method === "GET" && operation === "status") return response(await service.getStatus(projectId), requestId);
      if (request.method === "GET" && operation === "next") {
        return response(await service.getNext(projectId, Number(url.searchParams.get("max") ?? 5)), requestId);
      }
      if (request.method === "GET" && operation === "export") return response(await service.exportPackage(projectId), requestId);
      if (!canWrite(auth)) throw new DomainError("FORBIDDEN", "Seu perfil é somente leitura.", "Solicite a função EDITOR ou superior.", 403);
      if (request.method === "POST" && operation === "actions" && entityId) {
        return response(await service.completeAction(projectId, entityId, body.done !== false), requestId);
      }
      if (request.method === "POST" && operation === "checkpoints" && entityId) {
        return response(await service.completeCheckpoint(projectId, entityId, body.done !== false, body.force === true), requestId);
      }
      if (request.method === "POST" && operation === "reset") {
        if (body.confirm !== true) throw new DomainError("CONFIRMATION_REQUIRED", "Confirme a limpeza do progresso.", "Envie confirm=true.", 422);
        return response(await service.resetProgress(projectId), requestId);
      }
      if (request.method === "DELETE" && !operation) {
        if (body.confirm !== true) throw new DomainError("CONFIRMATION_REQUIRED", "Confirme a exclusão do projeto.", "Envie confirm=true.", 422);
        return response(await service.deleteProject(projectId), requestId);
      }
    }

    return json(
      { ok: false, error: { code: "NOT_FOUND", message: `Rota EXECUTAR inexistente: ${request.method} ${path}.` }, request_id: requestId },
      { status: 404 },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return json(
        {
          ok: false,
          error: { code: error.code, message: error.message, suggestion: error.suggestion },
          request_id: requestId,
        },
        { status: error.status },
      );
    }
    console.error(error instanceof Error ? error.message : String(error));
    return json(
      { ok: false, error: { code: "SERVER_ERROR", message: "Erro inesperado na API EXECUTAR." }, request_id: requestId },
      { status: 500 },
    );
  }
};
