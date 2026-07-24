import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";
import { verifyAccessToken } from "../src/lib/auth.js";
import { baseUrl, resourceUrl } from "../src/lib/env.js";
import { corsPreflight, withAbsoluteRequestUrl, withCors } from "../src/lib/http.js";
import { vaultStore } from "../src/lib/stores.js";
import { BlobVaultService } from "../src/lib/vault.js";
import { createMcpServer } from "../src/mcp-server.js";
import { DeskOsService } from "../src/application/desk-os-service.js";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.js";
import { ExecutarStore } from "../src/executar/store.js";
import { ExecutarService } from "../src/executar/service.js";
import { getWorkspaceMembershipAsService } from "../src/lib/supabase.js";

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

async function mcpHandler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["POST", "GET", "DELETE"]);
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return withCors(unauthorized());
  try {
    const token = auth.slice(7);
    const claims = await verifyAccessToken(token);
    if (!claims.scopes.includes("mcp:tools")) return withCors(new Response(JSON.stringify({ error: "insufficient_scope" }), { status: 403 }));
    const membership = await getWorkspaceMembershipAsService(claims.userId, claims.workspaceId);
    if (!membership) return withCors(unauthorized());
    if (membership.role === "VIEWER") {
      return withCors(new Response(JSON.stringify({ error: "insufficient_role" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }));
    }

    const store = vaultStore({ workspaceId: claims.workspaceId });
    const vault = new BlobVaultService(store);
    const server = createMcpServer(vault, {
      publicBaseUrl: baseUrl(),
      deskOsService: new DeskOsService(createDeskOsRepositories(store), vault),
      executarService: new ExecutarService(new ExecutarStore(store)),
      actorId: claims.userId,
      workspaceId: claims.workspaceId,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(withAbsoluteRequestUrl(request), {
        authInfo: { token, clientId: claims.clientId, scopes: claims.scopes, expiresAt: claims.expiresAt, resource: new URL(resourceUrl()) },
      });
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return withCors(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
    } finally {
      await server.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return withCors(unauthorized());
  }
}

export { mcpHandler };
export default createVercelNodeHandler(mcpHandler);
