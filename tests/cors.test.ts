import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oauthHandler } from "../api/oauth.js";
import { mcpHandler } from "../api/mcp.js";

const oauthRegisterHandler = oauthHandler;
const oauthTokenHandler = oauthHandler;
const oauthMetadataHandler = oauthHandler;
const oauthAuthorizeHandler = oauthHandler;

/**
 * The MCP authorization spec expects a client that may run in a browser
 * (e.g. claude.ai) to be able to reach the OAuth + /mcp endpoints
 * cross-origin. Before this fix, none of these endpoints sent any
 * Access-Control-* headers or answered OPTIONS preflight requests, which a
 * browser-based client would see as a silent network failure — a plausible
 * cause for "could not register" with no further detail.
 */
describe("CORS on OAuth + MCP endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("redirects an unauthenticated OAuth authorization to the workspace with CORS", async () => {
    const response = await oauthAuthorizeHandler(new Request("https://example.test/oauth/authorize?client_id=unknown", { method: "GET" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/app");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
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
