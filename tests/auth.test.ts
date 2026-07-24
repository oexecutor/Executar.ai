import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminCookie,
  appCookie,
  clearAppCookie,
  clearAdminCookie,
  hashToken,
  signAdminSession,
  signAppSession,
  verifyAppSession,
  verifyAdminPassword,
  verifyAdminRequest,
  verifyPkce,
} from "../src/lib/auth.js";
import { adminHandler } from "../api/admin.js";

const loginHandler = adminHandler;
const logoutHandler = adminHandler;

beforeEach(() => {
  vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OAuth helpers", () => {
  it("verifies an RFC 7636 S256 PKCE challenge", () => {
    const verifier = "test-verifier-with-enough-entropy-0123456789";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce("wrong-verifier", challenge)).toBe(false);
  });

  it("hashes secrets without returning the original", () => {
    expect(hashToken("secret")).not.toContain("secret");
  });
});

describe("admin password (Gate 0.5)", () => {
  it("accepts the configured password and rejects others", () => {
    expect(verifyAdminPassword("correct-horse-battery")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
    expect(verifyAdminPassword("")).toBe(false);
  });

  it("fails closed when ADMIN_PASSWORD is not configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    expect(verifyAdminPassword("anything")).toBe(false);
  });
});

describe("admin session", () => {
  it("round-trips a signed session cookie", async () => {
    const token = await signAdminSession();
    const request = new Request("https://example.test/api/vault/files", {
      headers: { cookie: adminCookie(token).split(";")[0] ?? "" },
    });
    expect(await verifyAdminRequest(request)).toBe(true);
  });

  it("rejects missing, malformed and forged cookies", async () => {
    expect(await verifyAdminRequest(new Request("https://example.test/"))).toBe(false);
    const garbage = new Request("https://example.test/", {
      headers: { cookie: "desk_os_admin=not.a.jwt" },
    });
    expect(await verifyAdminRequest(garbage)).toBe(false);
  });

  it("round-trips a workspace-bound application session", async () => {
    const token = await signAppSession({
      userId: "usr_1",
      email: "owner@example.test",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      role: "OWNER",
    });
    const cookie = appCookie(token);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    const request = new Request("https://example.test/api/executar/projects", {
      headers: { cookie: cookie.split(";")[0] ?? "" },
    });
    expect(await verifyAppSession(request)).toMatchObject({
      userId: "usr_1",
      workspaceName: "HQ",
      role: "OWNER",
    });
  });

  it("retires the public operator-password login", async () => {
    const response = await loginHandler(
      new Request("https://example.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "correct-horse-battery" }),
      }),
    );
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: { code: "LEGACY_LOGIN_RETIRED" } });
  });

  it("logout clears the application session cookie", async () => {
    const response = await logoutHandler(
      new Request("https://example.test/api/auth/logout", { method: "POST" }),
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(clearAppCookie()).toContain("Max-Age=0");
    expect(clearAdminCookie()).toContain("Max-Age=0");
  });
});

describe("workspace authentication guard", () => {
  it("fails closed without a session and accepts a signed workspace session", async () => {
    const { requireAdminJson, requireAdminHtml } = await import("../src/lib/admin-guard.js");
    expect((await requireAdminJson(new Request("https://example.test/api/vault/status")))?.status).toBe(401);
    expect((await requireAdminHtml(new Request("https://example.test/view")))?.status).toBe(303);

    const token = await signAppSession({
      userId: "usr_1",
      email: null,
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      role: "EDITOR",
    });
    const authenticated = new Request("https://example.test/api/vault/status", {
      headers: { cookie: appCookie(token).split(";")[0] ?? "" },
    });
    expect(await requireAdminJson(authenticated)).toBeNull();
  });

  it("revalidates a cookie membership and fails closed after revocation", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const token = await signAppSession({
      userId: "usr_revoked",
      email: "revoked@example.test",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      role: "OWNER",
    });
    const request = new Request("https://example.test/api/executar/projects", {
      headers: { cookie: appCookie(token).split(";")[0] ?? "" },
    });
    const { requireAdminJson } = await import("../src/lib/admin-guard.js");
    expect((await requireAdminJson(request))?.status).toBe(401);
  });
});
