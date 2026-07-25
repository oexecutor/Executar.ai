import { afterEach, describe, expect, it, vi } from "vitest";
import { adminHandler } from "../api/admin.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runtime authentication configuration", () => {
  it("reports public workspace mode with HTTP 200 when Supabase is absent", async () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("SUPABASE_ANON_KEY", undefined);

    const response = await adminHandler(new Request("https://example.test/api/auth/config"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        mode: "public",
        workspaceId: "public",
      },
    });
  });

  it("reports Supabase mode without exposing the service role key", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-secret");

    const response = await adminHandler(new Request("https://example.test/api/auth/config"));
    const payload = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
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
