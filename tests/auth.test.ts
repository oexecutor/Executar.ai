import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  adminCookie,
  clearAdminCookie,
  hashToken,
  signAdminSession,
  verifyAdminPassword,
  verifyAdminRequest,
  verifyPkce,
} from "../src/lib/auth.mjs";
import loginHandler from "../netlify/functions/admin-login.mjs";
import logoutHandler from "../netlify/functions/admin-logout.mjs";
import vaultFilesHandler from "../netlify/functions/vault-files.mjs";
import vaultStatusHandler from "../netlify/functions/vault-status.mjs";
import vaultImportHandler from "../netlify/functions/vault-import.mjs";
import vaultExportHandler from "../netlify/functions/vault-export.mjs";
import vaultViewHandler from "../netlify/functions/vault-view.mjs";
import workflowDashboardHandler from "../netlify/functions/workflow-dashboard.mjs";

const env: Record<string, string | undefined> = {};

function stubNetlifyEnv(): void {
  (globalThis as Record<string, unknown>).Netlify = {
    env: { get: (name: string) => env[name] },
  };
}

beforeEach(() => {
  env.PUBLIC_BASE_URL = "https://example.test";
  env.MCP_JWT_SECRET = "unit-test-secret-with-at-least-32-characters!!";
  env.ADMIN_PASSWORD = "correct-horse-battery";
  stubNetlifyEnv();
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
    env.ADMIN_PASSWORD = undefined;
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

  it("login sets an HttpOnly/Secure/SameSite=Lax cookie for the right password", async () => {
    const response = await loginHandler(
      new Request("https://example.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "correct-horse-battery" }),
      }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("login rejects a wrong password with 401 and reports 503 when unconfigured", async () => {
    const wrong = await loginHandler(
      new Request("https://example.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    expect(wrong.status).toBe(401);

    env.ADMIN_PASSWORD = undefined;
    const unconfigured = await loginHandler(
      new Request("https://example.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "anything" }),
      }),
    );
    expect(unconfigured.status).toBe(503);
  });

  it("logout clears the session cookie", async () => {
    const response = await logoutHandler(
      new Request("https://example.test/api/admin/logout", { method: "POST" }),
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(clearAdminCookie()).toContain("Max-Age=0");
  });
});

describe("vault routes require authentication (baseline §9 acceptance)", () => {
  it("JSON vault routes answer 401 without a session", async () => {
    const base = "https://example.test";
    expect((await vaultFilesHandler(new Request(`${base}/api/vault/files`))).status).toBe(401);
    expect(
      (
        await vaultFilesHandler(
          new Request(`${base}/api/vault/files`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: "a.md", content: "x" }),
          }),
        )
      ).status,
    ).toBe(401);
    expect((await vaultStatusHandler(new Request(`${base}/api/vault/status`))).status).toBe(401);
    expect(
      (await vaultImportHandler(new Request(`${base}/api/vault/import`, { method: "POST" }))).status,
    ).toBe(401);
    expect((await vaultExportHandler(new Request(`${base}/api/vault/export`))).status).toBe(401);
  });

  it("HTML routes answer with a login form instead of content", async () => {
    for (const [handler, path] of [
      [vaultViewHandler, "/view"],
      [workflowDashboardHandler, "/dashboard"],
    ] as const) {
      const response = await handler(new Request(`https://example.test${path}`));
      expect(response.status).toBe(401);
      const body = await response.text();
      expect(body).toContain("/api/admin/login");
      expect(body).not.toContain("STATUS_DASHBOARD");
    }
  });
});
