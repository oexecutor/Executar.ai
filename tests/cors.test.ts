import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import oauthRegisterHandler from "../netlify/functions/oauth-register.mjs";
import oauthTokenHandler from "../netlify/functions/oauth-token.mjs";
import oauthMetadataHandler from "../netlify/functions/oauth-metadata.mjs";
import oauthAuthorizeHandler from "../netlify/functions/oauth-authorize.mjs";
import mcpHandler from "../netlify/functions/mcp.mjs";

/**
 * The MCP authorization spec expects a client that may run in a browser
 * (e.g. claude.ai) to be able to reach the OAuth + /mcp endpoints
 * cross-origin. Before this fix, none of these endpoints sent any
 * Access-Control-* headers or answered OPTIONS preflight requests, which a
 * browser-based client would see as a silent network failure — a plausible
 * cause for "could not register" with no further detail.
 */
describe("CORS on OAuth + MCP endpoints", () => {
  const env: Record<string, string | undefined> = {};

  beforeEach(() => {
    env.PUBLIC_BASE_URL = "https://example.test";
    (globalThis as Record<string, unknown>).Netlify = { env: { get: (name: string) => env[name] } };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).Netlify;
  });

  it("answers OPTIONS preflight on /oauth/register with CORS headers", async () => {
    const response = await oauthRegisterHandler(new Request("https://example.test/oauth/register", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("attaches CORS headers to an actual /oauth/register response", async () => {
    const response = await oauthRegisterHandler(
      new Request("https://example.test/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirect_uris: ["not-a-valid-uri"] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers OPTIONS preflight on /oauth/token with CORS headers", async () => {
    const response = await oauthTokenHandler(new Request("https://example.test/oauth/token", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("attaches CORS headers to a rejected /oauth/token method", async () => {
    const response = await oauthTokenHandler(new Request("https://example.test/oauth/token", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers OPTIONS preflight on the discovery metadata endpoint with CORS headers", async () => {
    const response = await oauthMetadataHandler(
      new Request("https://example.test/.well-known/oauth-authorization-server", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("attaches CORS headers to the discovery metadata GET response", async () => {
    const response = await oauthMetadataHandler(
      new Request("https://example.test/.well-known/oauth-authorization-server", { method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await response.json()) as { registration_endpoint: string };
    expect(body.registration_endpoint).toBe("https://example.test/oauth/register");
  });

  it("answers OPTIONS preflight on /oauth/authorize with CORS headers", async () => {
    const response = await oauthAuthorizeHandler(new Request("https://example.test/oauth/authorize", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("attaches CORS headers to an /oauth/authorize error response, including when the lookup itself fails", async () => {
    // No Netlify Blobs runtime is configured in this test environment, so
    // oauthStore().get() throws before validate() can even reach its own
    // "unknown client" check — the response falls through to safeError's
    // 500. What this test actually guards is that CORS headers are present
    // on *every* exit path of the handler, not just the happy path.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await oauthAuthorizeHandler(new Request("https://example.test/oauth/authorize?client_id=unknown", { method: "GET" }));
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    consoleErrorSpy.mockRestore();
  });

  it("answers OPTIONS preflight on /mcp with CORS headers without requiring auth", async () => {
    const response = await mcpHandler(new Request("https://example.test/mcp", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("attaches CORS headers to a /mcp 401 response", async () => {
    const response = await mcpHandler(new Request("https://example.test/mcp", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
