import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adminSessionCookie,
  createAdminSessionToken,
  createMcpAccessToken,
  verifyAdminPassword,
  verifyAdminRequest,
  verifyMcpRequest,
} from "../src/lib/auth.mjs";
import { VaultProblem } from "../src/lib/http.mjs";
import loginHandler from "../netlify/functions/admin-login.mjs";
import logoutHandler from "../netlify/functions/admin-logout.mjs";
import vaultFilesHandler from "../netlify/functions/vault-files.mjs";
import { setVaultForTesting } from "../src/lib/vault-instance.mjs";
import { BlobVaultService } from "../src/lib/vault.mjs";
import { MemoryBlobStore } from "./helpers/memory-store.mjs";

const BASE = "http://localhost/api/vault-files";

function adminCookieHeader(): string {
  return adminSessionCookie(createAdminSessionToken()).split(";")[0];
}

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "correct-horse";
  process.env.MCP_JWT_SECRET = "test-secret-key-for-vitest-only";
  setVaultForTesting(new BlobVaultService(new MemoryBlobStore()));
});

afterEach(() => {
  setVaultForTesting(null);
  delete process.env.ADMIN_PASSWORD;
  delete process.env.MCP_JWT_SECRET;
});

describe("verifyAdminPassword", () => {
  it("accepts the configured password and rejects others", () => {
    expect(verifyAdminPassword("correct-horse")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
    expect(verifyAdminPassword("")).toBe(false);
  });

  it("fails closed when ADMIN_PASSWORD is not configured", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(() => verifyAdminPassword("anything")).toThrow(VaultProblem);
  });
});

describe("admin session", () => {
  it("issues a cookie-backed session that verifyAdminRequest accepts", async () => {
    const request = new Request(BASE, { headers: { cookie: adminCookieHeader() } });
    expect(await verifyAdminRequest(request)).toBe(true);
  });

  it("rejects requests without or with tampered cookies", async () => {
    expect(await verifyAdminRequest(new Request(BASE))).toBe(false);
    const tampered = new Request(BASE, { headers: { cookie: "desk_os_session=abc.def.ghi" } });
    expect(await verifyAdminRequest(tampered)).toBe(false);
  });

  it("sets HttpOnly/Secure/SameSite=Lax attributes on login", async () => {
    const response = await loginHandler(
      new Request("http://localhost/api/admin-login", {
        method: "POST",
        body: JSON.stringify({ password: "correct-horse" }),
      }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("returns 401 for a wrong password and clears the cookie on logout", async () => {
    const bad = await loginHandler(
      new Request("http://localhost/api/admin-login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    expect(bad.status).toBe(401);
    const out = await logoutHandler(new Request("http://localhost/api/admin-logout", { method: "POST" }));
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("vault-files authorization (baseline §9: unauthenticated write fails)", () => {
  it("rejects unauthenticated reads and writes with 401", async () => {
    const read = await vaultFilesHandler(new Request(BASE));
    expect(read.status).toBe(401);
    const write = await vaultFilesHandler(
      new Request(BASE, { method: "POST", body: JSON.stringify({ path: "a.md", content: "x" }) }),
    );
    expect(write.status).toBe(401);
  });

  it("allows an authenticated create/read/edit cycle", async () => {
    const cookie = adminCookieHeader();
    const created = await vaultFilesHandler(
      new Request(BASE, {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({ path: "notes/a.md", content: "v1" }),
      }),
    );
    expect(created.status).toBe(201);
    const { file } = (await created.json()) as { file: { sha256: string } };

    const read = await vaultFilesHandler(
      new Request(`${BASE}?path=notes/a.md`, { headers: { cookie } }),
    );
    expect(read.status).toBe(200);

    const edited = await vaultFilesHandler(
      new Request(BASE, {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ path: "notes/a.md", content: "v2", expectedSha256: file.sha256 }),
      }),
    );
    expect(edited.status).toBe(200);
  });

  it("blocks the reserved _desk-os prefix even when authenticated", async () => {
    const cookie = adminCookieHeader();
    const response = await vaultFilesHandler(
      new Request(BASE, {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({ path: "_desk-os/state/x.json", content: "{}" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe("MCP bearer tokens", () => {
  it("accepts a minted bearer token and rejects admin-session tokens", async () => {
    const good = new Request(BASE, {
      headers: { authorization: `Bearer ${createMcpAccessToken()}` },
    });
    expect(await verifyMcpRequest(good)).toBe(true);
    const wrongAudience = new Request(BASE, {
      headers: { authorization: `Bearer ${createAdminSessionToken()}` },
    });
    expect(await verifyMcpRequest(wrongAudience)).toBe(false);
    expect(await verifyMcpRequest(new Request(BASE))).toBe(false);
  });
});
