import type { Config } from "@netlify/functions";
import { corsPreflight, html, methodNotAllowed, safeError, withCors } from "../../src/lib/http.mjs";
import { hashToken, randomToken } from "../../src/lib/auth.mjs";
import { oauthStore } from "../../src/lib/stores.mjs";
import { resourceUrl } from "../../src/lib/env.mjs";
import type { AuthorizationCode, OAuthClient } from "../../src/lib/types.mjs";

type Params = Record<string, string>;

function readParams(url: URL, form?: URLSearchParams): Params {
  const source = form ?? url.searchParams;
  return Object.fromEntries([...source.entries()]);
}

async function validate(params: Params): Promise<{ client: OAuthClient; error?: string }> {
  const client = await oauthStore().get(`client/${params.client_id ?? ""}`, { type: "json" }) as OAuthClient | null;
  if (!client) return { client: {} as OAuthClient, error: "Cliente OAuth desconhecido." };
  if (params.response_type !== "code") return { client, error: "response_type deve ser code." };
  if (!client.redirectUris.includes(params.redirect_uri ?? "")) return { client, error: "redirect_uri não registrado." };
  if (params.code_challenge_method !== "S256" || !params.code_challenge) return { client, error: "PKCE S256 é obrigatório." };
  if (params.resource !== resourceUrl()) return { client, error: "Recurso MCP inválido." };
  return { client };
}

function errorPage(message: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESK-OS OAuth</title></head><body><main><h1>Não foi possível conectar</h1><p>${message.replace(/[<>&"]/g, "")}</p></main></body></html>`;
}

export default async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return corsPreflight(["GET", "POST"]);
  if (!["GET", "POST"].includes(request.method)) return withCors(methodNotAllowed(["GET", "POST"]));
  try {
    const url = new URL(request.url);
    const form = request.method === "POST" ? new URLSearchParams(await request.text()) : undefined;
    const params = readParams(url, form);
    const validation = await validate(params);
    if (validation.error) return withCors(html(errorPage(validation.error), { status: 400 }));

    const code = randomToken(32);
    const record: AuthorizationCode = {
      clientId: params.client_id!,
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
};

export const config: Config = { path: "/oauth/authorize" };
