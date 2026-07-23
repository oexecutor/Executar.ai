import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeError } from "../src/lib/http.mjs";
import { VaultProblem } from "../src/lib/vault.mjs";
import oauthTokenHandler from "../api/oauth-token.mjs";

/**
 * baseline §11.6: safeError previously wrote error.message straight into
 * the response for ANY exception (parser internals, blob-store errors,
 * a misconfigured secret) — fine for VaultProblem, a real leak for
 * everything else. These tests prove the leak is closed while the
 * existing flat {error, message} wire shape (which oauth-token.mts and
 * oauth-register.mts rely on for RFC 6749 compatibility) is unchanged.
 */

describe("safeError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not leak a raw Error message from an unexpected exception", async () => {
    const response = safeError(new Error("blob store credentials rejected: sk_live_super_secret_token"));
    const body = (await response.json()) as { error: string; message: string };
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "server_error", message: "An unexpected error occurred." });
    expect(JSON.stringify(body)).not.toContain("sk_live_super_secret_token");
  });

  it("logs the real detail server-side only", async () => {
    safeError(new Error("internal detail that must never reach the client"));
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleErrorSpy.mock.calls[0]?.[0])).toContain("internal detail that must never reach the client");
  });

  it("does not leak non-Error thrown values either", async () => {
    const response = safeError("plain string throw with internal path /etc/secrets");
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("An unexpected error occurred.");
  });

  it("still surfaces a VaultProblem's own client-safe message", async () => {
    const response = safeError(new VaultProblem("NOT_FOUND", "File not found: notes/a.md", "List the folder."));
    const body = (await response.json()) as { error: string; message: string };
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "NOT_FOUND", message: "File not found: notes/a.md" });
  });

  it("keeps the flat {error, message} shape oauth-token.mts's RFC 6749 responses rely on", async () => {
    const response = safeError(new Error("x"));
    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });
});

describe("oauth-token.mts does not leak internals through its safeError catch-all", () => {
  beforeEach(() => {
    // MCP_JWT_SECRET intentionally absent/short: signAccessToken() throws a
    // real internal Error ("...must contain at least 32 characters"), which
    // must never reach the HTTP response body.
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
    vi.stubEnv("MCP_JWT_SECRET", "too-short");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns a generic message instead of the unconfigured-store internal error", async () => {
    // No Postgres connection string is configured in this test environment,
    // so oauthStore().get(...) throws its own internal Error — a realistic
    // stand-in for "parser internals, blob-store errors" (baseline §11.6).
    const response = await oauthTokenHandler(
      new Request("https://example.test/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: "does-not-exist" }).toString(),
      }),
    );
    const body = (await response.json()) as { error: string; message: string };
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "server_error", message: "An unexpected error occurred." });
    expect(JSON.stringify(body).toLowerCase()).not.toContain("netlify blobs");
  });
});
