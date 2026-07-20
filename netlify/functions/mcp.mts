import type { Config } from "@netlify/functions";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyAccessToken } from "../../src/lib/auth.mjs";
import { baseUrl, resourceUrl } from "../../src/lib/env.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService } from "../../src/lib/vault.mjs";
import { createMcpServer } from "../../src/mcp-server.mjs";

function unauthorized(): Response {
  const metadata = `${baseUrl()}/.well-known/oauth-protected-resource/mcp`;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Bearer realm="desk-os-obsidian", resource_metadata="${metadata}", scope="mcp:tools"`,
    },
  });
}

export default async (request: Request): Promise<Response> => {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();
  try {
    const token = auth.slice(7);
    const claims = await verifyAccessToken(token);
    if (!claims.scopes.includes("mcp:tools")) return new Response(JSON.stringify({ error: "insufficient_scope" }), { status: 403 });

    const server = createMcpServer(new BlobVaultService(vaultStore()), { publicBaseUrl: baseUrl() });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, {
        authInfo: { token, clientId: claims.clientId, scopes: claims.scopes, expiresAt: claims.expiresAt, resource: new URL(resourceUrl()) },
      });
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } finally {
      await server.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return unauthorized();
  }
};

export const config: Config = { path: "/mcp" };
