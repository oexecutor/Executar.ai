import crypto from "node:crypto";
import { hashToken, randomToken, signAccessToken, verifyPkce } from "../src/lib/auth.js";
import { baseUrl, resourceUrl } from "../src/lib/env.js";
import { absoluteUrl, corsPreflight, html, json, methodNotAllowed, safeError, withCors } from "../src/lib/http.js";
import { oauthStore } from "../src/lib/stores.js";
import { getWorkspaceMembershipAsService } from "../src/lib/supabase.js";
import { getAuthenticatedRequest } from "../src/lib/request-auth.js";
import type { AuthorizationCode, OAuthClient, RefreshGrant } from "../src/lib/types.js";

/**
 * All four OAuth endpoints (register/authorize/token/discovery) live in one
 * function, dispatched by pathname, to stay under Vercel's 12-function
 * Hobby-plan cap — see api/admin.ts and api/vault.ts for the same pattern.
 * Each section below is otherwise unchanged from its own former file.
 */

function validRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

async function register(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["POST"]);
  if (request.method !== "POST") return withCors(methodNotAllowed(["POST"]));
  try {
    const body = await request.json() as Record<string, unknown>;
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string") : [];
    if (redirectUris.length < 1 || redirectUris.length > 5 || !redirectUris.every(validRedirect)) {
      return withCors(json({ error: "invalid_redirect_uri", error_description: "Provide 1-5 HTTPS or localhost redirect URIs." }, { status: 400 }));
    }
    const clientId = `mcp_${crypto.randomUUID()}`;
    const client: OAuthClient = {
      clientId,
      clientName: typeof body.client_name === "string" ? body.client_name.slice(0, 120) : "MCP Client",
      redirectUris,
      createdAt: new Date().toISOString(),
    };
    await oauthStore().setJSON(`client/${clientId}`, client);
    return withCors(json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }, { status: 201 }));
  } catch (error) {
    return withCors(safeError(error));
  }
}

type AuthorizeParams = Record<string, string>;

function readAuthorizeParams(url: URL, form?: URLSearchParams): AuthorizeParams {
  const source = form ?? url.searchParams;
  return Object.fromEntries([...source.entries()]);
}

async function validateAuthorize(params: AuthorizeParams): Promise<{ client: OAuthClient; error?: string }> {
  const client = await oauthStore().get(`client/${params.client_id ?? ""}`, { type: "json" }) as OAuthClient | null;
  if (!client) return { client: {} as OAuthClient, error: "Cliente OAuth desconhecido." };
  if (params.response_type !== "code") return { client, error: "response_type deve ser code." };
  if (!client.redirectUris.includes(params.redirect_uri ?? "")) return { client, error: "redirect_uri não registrado." };
  if (params.code_challenge_method !== "S256" || !params.code_challenge) return { client, error: "PKCE S256 é obrigatório." };
  if (params.resource !== resourceUrl()) return { client, error: "Recurso MCP inválido." };
  return { client };
}

function authorizeErrorPage(message: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESK-OS OAuth</title></head><body><main><h1>Não foi possível conectar</h1><p>${message.replace(/[<>&"]/g, "")}</p></main></body></html>`;
}

async function authorize(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["GET", "POST"]);
  if (!["GET", "POST"].includes(request.method)) return withCors(methodNotAllowed(["GET", "POST"]));
  try {
    const url = absoluteUrl(request);
    const session = await getAuthenticatedRequest(request);
    if (!session) {
      const returnTo = `${url.pathname}${url.search}`;
      return withCors(Response.redirect(`${baseUrl()}/entrar?return_to=${encodeURIComponent(returnTo)}`, 303));
    }
    const form = request.method === "POST" ? new URLSearchParams(await request.text()) : undefined;
    const params = readAuthorizeParams(url, form);
    const validation = await validateAuthorize(params);
    if (validation.error) return withCors(html(authorizeErrorPage(validation.error), { status: 400 }));

    const code = randomToken(32);
    const record: AuthorizationCode = {
      clientId: params.client_id!,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri: params.redirect_uri!,
      codeChallenge: params.code_challenge!,
      resource: params.resource!,
      scope: params.scope || "mcp:tools",
      expiresAt: Date.now() + 5 * 60_000,
    };
    await oauthStore().setJSON(`code/${hashToken(code)}`, record);
    const redirect = new URL(record.redirectUri);
    redirect.searchParams.set("code", code);
    if (params.state) redirect.searchParams.set("state", params.state);
    return Response.redirect(redirect.toString(), 302);
  } catch (error) {
    return withCors(safeError(error));
  }
}

async function issueToken(
  clientId: string,
  userId: string,
  workspaceId: string,
  scope: string,
  resource: string,
): Promise<Response> {
  const membership = await getWorkspaceMembershipAsService(userId, workspaceId);
  if (!membership) return json({ error: "invalid_grant", error_description: "Workspace membership is no longer active." }, { status: 400 });
  if (membership.role === "VIEWER") {
    return json({ error: "insufficient_role", error_description: "A read-only membership cannot authorize MCP mutations." }, { status: 403 });
  }
  const access = await signAccessToken({ clientId, userId, workspaceId, scope });
  const refreshToken = randomToken(48);
  const grant: RefreshGrant = {
    clientId,
    userId,
    workspaceId,
    scope,
    resource,
    expiresAt: Date.now() + 30 * 24 * 60 * 60_000,
  };
  await oauthStore().setJSON(`refresh/${hashToken(refreshToken)}`, grant);
  return json({ access_token: access.token, token_type: "Bearer", expires_in: access.expiresIn, refresh_token: refreshToken, scope });
}

async function handleToken(request: Request): Promise<Response> {
  try {
    const form = new URLSearchParams(await request.text());
    const grantType = form.get("grant_type");
    if (grantType === "authorization_code") {
      const code = form.get("code") ?? "";
      const codeKey = `code/${hashToken(code)}`;
      const record = await oauthStore().get(codeKey, { type: "json" }) as AuthorizationCode | null;
      if (!record || record.expiresAt < Date.now()) return json({ error: "invalid_grant" }, { status: 400 });
      if (form.get("client_id") !== record.clientId || form.get("redirect_uri") !== record.redirectUri) return json({ error: "invalid_grant" }, { status: 400 });
      if (form.get("resource") !== record.resource || record.resource !== resourceUrl()) return json({ error: "invalid_target" }, { status: 400 });
      if (!verifyPkce(form.get("code_verifier") ?? "", record.codeChallenge)) return json({ error: "invalid_grant" }, { status: 400 });
      await oauthStore().delete(codeKey);
      return issueToken(record.clientId, record.userId, record.workspaceId, record.scope, record.resource);
    }
    if (grantType === "refresh_token") {
      const refresh = form.get("refresh_token") ?? "";
      const key = `refresh/${hashToken(refresh)}`;
      const record = await oauthStore().get(key, { type: "json" }) as RefreshGrant | null;
      if (!record || record.expiresAt < Date.now() || form.get("client_id") !== record.clientId || form.get("resource") !== record.resource) {
        return json({ error: "invalid_grant" }, { status: 400 });
      }
      await oauthStore().delete(key);
      return issueToken(record.clientId, record.userId, record.workspaceId, record.scope, record.resource);
    }
    return json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (error) {
    return safeError(error);
  }
}

async function token(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["POST"]);
  if (request.method !== "POST") return withCors(methodNotAllowed(["POST"]));
  return withCors(await handleToken(request));
}

async function metadata(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["GET"]);
  try {
    const pathname = absoluteUrl(request).pathname;
    if (pathname.includes("oauth-protected-resource")) {
      return withCors(json({
        resource: resourceUrl(),
        authorization_servers: [baseUrl()],
        scopes_supported: ["mcp:tools"],
        bearer_methods_supported: ["header"],
      }));
    }
    return withCors(json({
      issuer: baseUrl(),
      authorization_endpoint: `${baseUrl()}/oauth/authorize`,
      token_endpoint: `${baseUrl()}/oauth/token`,
      registration_endpoint: `${baseUrl()}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools", "offline_access"],
    }));
  } catch (error) {
    return withCors(safeError(error));
  }
}

export default async (request: Request): Promise<Response> => {
  const pathname = absoluteUrl(request).pathname;
  if (pathname === "/oauth/register") return register(request);
  if (pathname === "/oauth/authorize") return authorize(request);
  if (pathname === "/oauth/token") return token(request);
  if (pathname.startsWith("/.well-known/")) return metadata(request);
  return withCors(json({ error: "not_found" }, { status: 404 }));
};
