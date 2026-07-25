import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthorizedWorkspace } from "../src/lib/workspace-authorization.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("workspace authorization modes", () => {
  it("authorizes only the canonical public identity when Supabase is absent", async () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("SUPABASE_ANON_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    await expect(resolveAuthorizedWorkspace("public", "public")).resolves.toMatchObject({
      workspaceId: "public",
      workspaceSlug: "public",
      role: "OWNER",
    });
    await expect(resolveAuthorizedWorkspace("other-user", "public")).resolves.toBeNull();
    await expect(resolveAuthorizedWorkspace("public", "other-workspace")).resolves.toBeNull();
  });

  it("fails closed when Supabase is selected but the service role is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    await expect(resolveAuthorizedWorkspace("usr_1", "wsp_1"))
      .rejects.toThrow("SUPABASE_SERVICE_ROLE_CONFIG_MISSING");
  });
});
