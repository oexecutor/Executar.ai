import crypto from "node:crypto";
import { DomainError } from "../src/domain/errors.js";
import { createEditorialSqlClient, PostgresEditorialStore } from "../src/editorial/postgres-store.js";
import { EditorialService } from "../src/editorial/service.js";
import { EditorialStore, MigratingEditorialStore } from "../src/editorial/store.js";
import { EDITORIAL_ADAPTERS, type EditorialAdapterName } from "../src/editorial/types.js";
import { requireAdminJson } from "../src/lib/admin-guard.js";
import { absoluteUrl, json } from "../src/lib/http.js";
import { canWriteWorkspace, getAuthenticatedRequest, type AuthenticatedRequest } from "../src/lib/request-auth.js";
import { vaultStore } from "../src/lib/stores.js";
import { isProduction } from "../src/lib/env.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

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

function defaultService(auth: AuthenticatedRequest): EditorialService {
  const legacy = new EditorialStore(
    vaultStore({ workspaceId: auth.workspaceId, accessToken: auth.accessToken }),
  );
  const primary = new PostgresEditorialStore(
    createEditorialSqlClient(),
    auth.workspaceId,
    isProduction() ? "production" : "preview",
  );
  return new EditorialService(
    new MigratingEditorialStore(primary, legacy),
  );
}

let serviceFactory: (auth: AuthenticatedRequest) => EditorialService = defaultService;

export function setEditorialServiceForTesting(factory: (() => EditorialService) | null): void {
  serviceFactory = factory ?? defaultService;
}

function requireWrite(auth: AuthenticatedRequest): void {
  if (!canWriteWorkspace(auth)) {
    throw new DomainError("FORBIDDEN", "Seu perfil é somente leitura.", "Solicite a função EDITOR ou superior.", 403);
  }
}

function text(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === "string" ? body[key] : undefined;
}

function actor(body: Record<string, unknown>, auth: AuthenticatedRequest): string {
  return text(body, "actor")?.trim() || auth.email || auth.userId;
}

async function editorialHandler(request: Request): Promise<Response> {
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  const auth = await getAuthenticatedRequest(request);
  if (!auth) return json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sessão inválida." } }, { status: 401 });

  const requestId = `req_${crypto.randomUUID()}`;
  const url = absoluteUrl(request);
  const path = url.pathname.replace(/^\/api\/editorial/, "") || "/";
  const service = serviceFactory(auth);

  try {
    const body = request.method === "GET"
      ? {}
      : await request.json().catch(() => ({})) as Record<string, unknown>;

    if (request.method === "GET" && path === "/publications") {
      return response(await service.listPublications(), requestId);
    }
    if (request.method === "POST" && path === "/validate") {
      return response(service.validate(body.publication ?? body), requestId);
    }
    if (request.method === "POST" && path === "/publications") {
      requireWrite(auth);
      return response(await service.createPublication({
        title: text(body, "title"),
        summary: text(body, "summary"),
        audience: text(body, "audience"),
        objective: text(body, "objective"),
        author: text(body, "author"),
        source_text: text(body, "source_text"),
        slug: text(body, "slug"),
        keywords: Array.isArray(body.keywords) ? body.keywords.filter((value): value is string => typeof value === "string") : undefined,
        actor: actor(body, auth),
      }), requestId, 201);
    }

    const match = path.match(/^\/publications\/(PUB-[A-Za-z0-9-]+)(?:\/(.*))?$/);
    if (match) {
      const publicationId = match[1] ?? "";
      const operation = match[2] ?? "";

      if (request.method === "GET" && operation === "") return response(await service.getPublication(publicationId), requestId);
      if (request.method === "GET" && operation === "export") return response(await service.exportPackage(publicationId), requestId);
      requireWrite(auth);

      if (request.method === "PUT" && operation === "content") {
        return response(await service.updateContent(publicationId, {
          markdown: text(body, "markdown"),
          excerpt: text(body, "excerpt"),
          slug: text(body, "slug"),
          actor: actor(body, auth),
        }), requestId);
      }
      if (request.method === "POST" && operation === "validate") {
        return response(await service.runQualityGate(publicationId, actor(body, auth)), requestId);
      }
      if (request.method === "POST" && operation === "adapters") {
        throw new DomainError(
          "MANUAL_ADAPTER_STATE_FORBIDDEN",
          "O estado dos adapters não pode ser marcado manualmente.",
          "Use POST /adapters/run para executar os critérios e registrar evidência.",
          409,
        );
      }
      if (request.method === "POST" && operation === "adapters/run") {
        const adapter = text(body, "adapter");
        if (!adapter) {
          return response(await service.runAdapters(publicationId, actor(body, auth)), requestId);
        }
        if (!EDITORIAL_ADAPTERS.includes(adapter as EditorialAdapterName)) {
          throw new DomainError("INVALID_ADAPTER", `Adapter editorial inválido: ${adapter}.`, "Use deskgo, frankwatching ou ames.", 422);
        }
        return response(await service.runAdapter(
          publicationId,
          adapter as EditorialAdapterName,
          actor(body, auth),
        ), requestId);
      }
      if (request.method === "POST" && operation === "preview/start") {
        const branch = text(body, "branch");
        const commitSha = text(body, "commit_sha");
        if (!branch || !commitSha) throw new DomainError("INVALID_INPUT", "branch e commit_sha são obrigatórios.", "Registre o artefato GitHub antes do build.", 422);
        return response(await service.startPreview(publicationId, {
          branch,
          commit_sha: commitSha,
          pull_request_number: typeof body.pull_request_number === "number" ? body.pull_request_number : undefined,
          pull_request_url: text(body, "pull_request_url"),
          publication_version: typeof body.publication_version === "number" ? body.publication_version : undefined,
          content_hash: text(body, "content_hash"),
          actor: actor(body, auth),
        }), requestId);
      }
      if (request.method === "POST" && operation === "preview/attach") {
        const previewUrl = text(body, "url");
        if (!previewUrl) throw new DomainError("INVALID_INPUT", "url é obrigatória.", "Informe a URL imutável do Vercel Preview.", 422);
        return response(await service.attachPreview(publicationId, {
          url: previewUrl,
          deployment_id: text(body, "deployment_id"),
          actor: actor(body, auth),
        }), requestId);
      }
      if (request.method === "POST" && operation === "review/start") {
        return response(await service.startReview(publicationId, actor(body, auth)), requestId);
      }
      if (request.method === "POST" && operation === "review") {
        const decision = body.decision;
        const reviewer = text(body, "reviewer")?.trim() || auth.email || auth.userId;
        if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") {
          throw new DomainError("INVALID_INPUT", "decision deve ser APPROVED ou CHANGES_REQUESTED.", "Registre uma decisão humana explícita.", 422);
        }
        return response(await service.review(publicationId, {
          decision,
          reviewer,
          note: text(body, "note"),
        }), requestId);
      }
      if (request.method === "POST" && operation === "publish/start") {
        return response(await service.startPublishing(publicationId, actor(body, auth)), requestId);
      }
      if (request.method === "POST" && operation === "publish/complete") {
        const publicationUrl = text(body, "url");
        const commitSha = text(body, "commit_sha");
        if (!publicationUrl || !commitSha) throw new DomainError("INVALID_INPUT", "url e commit_sha são obrigatórios.", "Registre a evidência exata da publicação.", 422);
        return response(await service.markPublished(publicationId, {
          url: publicationUrl,
          commit_sha: commitSha,
          actor: actor(body, auth),
        }), requestId);
      }
      if (request.method === "DELETE" && operation === "") {
        if (body.confirm !== true) throw new DomainError("CONFIRMATION_REQUIRED", "Confirme a exclusão da publicação.", "Envie confirm=true.", 422);
        return response(await service.deletePublication(publicationId), requestId);
      }
    }

    return json(
      { ok: false, error: { code: "NOT_FOUND", message: `Rota editorial inexistente: ${request.method} ${path}.` }, request_id: requestId },
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
      { ok: false, error: { code: "SERVER_ERROR", message: "Erro inesperado na API editorial." }, request_id: requestId },
      { status: 500 },
    );
  }
}

export { editorialHandler };
export default createVercelNodeHandler(editorialHandler);
