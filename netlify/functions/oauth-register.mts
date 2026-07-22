import crypto from "node:crypto";
import type { Config } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed, safeError, withCors } from "../../src/lib/http.mjs";
import { oauthStore } from "../../src/lib/stores.mjs";
import type { OAuthClient } from "../../src/lib/types.mjs";

function validRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

export default async (request: Request): Promise<Response> => {
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
};

export const config: Config = { path: "/oauth/register" };
