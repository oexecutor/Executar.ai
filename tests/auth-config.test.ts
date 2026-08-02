import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandler } from "../api/admin.js";

beforeEach(() => {
  vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
  vi.stubEnv("SUPABASE_URL", undefined);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
  vi.stubEnv("SUPABASE_ANON_KEY", undefined);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
  vi.stubEnv("ALLOW_PUBLIC_WORKSPACE_FALLBACK", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase runtime configuration", () => {
  it("fails closed when multi-user authentication is not configured", async () => {
    const response = await adminHandler(new Request("https://example.test/api/auth/config"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "SUPABASE_NOT_CONFIGURED" },
    });
  });

  it("exposes public mode only after an explicit demo-only opt-in", async () => {
    vi.stubEnv("ALLOW_PUBLIC_WORKSPACE_FALLBACK", "true");
    const response = await adminHandler(new Request("https://example.test/api/auth/config"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { mode: "public", workspaceId: "public" },
    });
  });

  it("returns only the browser-safe Supabase configuration", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co/");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-secret");
    const response = await adminHandler(new Request("https://example.test/api/auth/config"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      data: {
        mode: "supabase",
        url: "https://project.supabase.co",
        publishableKey: "publishable-test-key",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("server-only-secret");
  });
});
