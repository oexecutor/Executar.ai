import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";
import {
  appCookie,
  clearAppCookie,
  signAppSession,
} from "../src/lib/auth.js";
import { absoluteUrl, json, methodNotAllowed } from "../src/lib/http.js";
import { getAuthenticatedRequest } from "../src/lib/request-auth.js";
import {
  authenticateSupabaseUser,
  getSupabasePublicConfig,
  listWorkspaceMemberships,
} from "../src/lib/supabase.js";

function privateJson(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Authorization, Cookie");
  return json(body, { ...init, headers });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  return await request.json().catch(() => ({})) as Record<string, unknown>;
}

async function runtimeConfig(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const config = getSupabasePublicConfig();
  if (!config) {
    return privateJson({
      ok: false,
      error: {
        code: "AUTH_NOT_CONFIGURED",
        message: "O ambiente Supabase ainda não foi configurado.",
      },
    }, { status: 503 });
  }
  return privateJson({ ok: true, data: config });
}

async function workspaces(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const input = await body(request);
  const accessToken = typeof input.access_token === "string" ? input.access_token : "";
  const user = await authenticateSupabaseUser(accessToken);
  if (!user) {
    return privateJson({ ok: false, error: { code: "UNAUTHORIZED", message: "Sessão Supabase inválida." } }, { status: 401 });
  }
  const memberships = await listWorkspaceMemberships(accessToken, user.id);
  return privateJson({ ok: true, data: { user, memberships } });
}

async function createSession(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const input = await body(request);
  const accessToken = typeof input.access_token === "string" ? input.access_token : "";
  const workspaceId = typeof input.workspace_id === "string" ? input.workspace_id : "";
  const user = await authenticateSupabaseUser(accessToken);
  if (!user) {
    return privateJson({ ok: false, error: { code: "UNAUTHORIZED", message: "Sessão Supabase inválida." } }, { status: 401 });
  }
  const membership = (await listWorkspaceMemberships(accessToken, user.id))
    .find((candidate) => candidate.workspaceId === workspaceId);
  if (!membership) {
    return privateJson({
      ok: false,
      error: { code: "WORKSPACE_FORBIDDEN", message: "Você não possui acesso ativo a esse workspace." },
    }, { status: 403 });
  }
  const session = {
    userId: user.id,
    email: user.email,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    role: membership.role,
  };
  const token = await signAppSession(session);
  return privateJson(
    { ok: true, data: session },
    { headers: { "Set-Cookie": appCookie(token) } },
  );
}

async function currentSession(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const session = await getAuthenticatedRequest(request);
  return session
    ? privateJson({ ok: true, data: session })
    : privateJson({ ok: false, error: { code: "UNAUTHORIZED", message: "Sessão não encontrada." } }, { status: 401 });
}

async function logout(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  return privateJson(
    { ok: true, data: { authenticated: false } },
    { headers: { "Set-Cookie": clearAppCookie() } },
  );
}

async function adminHandler(request: Request): Promise<Response> {
  const pathname = absoluteUrl(request).pathname;
  try {
    if (pathname === "/api/auth/config") return runtimeConfig(request);
    if (pathname === "/api/auth/workspaces") return workspaces(request);
    if (pathname === "/api/auth/session") return createSession(request);
    if (pathname === "/api/auth/me") return currentSession(request);
    if (pathname === "/api/auth/logout" || pathname === "/api/admin/logout") return logout(request);
    if (pathname === "/api/admin/login") {
      return privateJson({
        ok: false,
        error: {
          code: "LEGACY_LOGIN_RETIRED",
          message: "O login de operador foi substituído por contas Supabase com workspace.",
        },
      }, { status: 410 });
    }
    return privateJson({ ok: false, error: { code: "NOT_FOUND", message: "Rota de autenticação inexistente." } }, { status: 404 });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return privateJson({
      ok: false,
      error: { code: "AUTH_SERVICE_ERROR", message: "Não foi possível validar a autenticação." },
    }, { status: 503 });
  }
}

export { adminHandler };
export default createVercelNodeHandler(adminHandler);
