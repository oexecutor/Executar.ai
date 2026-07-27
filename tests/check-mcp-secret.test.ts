import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("../scripts/check-mcp-secret.mjs", import.meta.url),
);

function runGuard(
  overrides: Record<string, string | undefined>,
): ReturnType<typeof spawnSync> {
  const env = { ...process.env };
  delete env.MCP_JWT_SECRET;
  delete env.VERCEL_PROJECT_PRODUCTION_URL;

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }

  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env,
  });
}

describe("MCP build secret guard", () => {
  it("accepts a 32-byte secret for the canonical MCP project", () => {
    const result = runGuard({
      MCP_JWT_SECRET: "0123456789abcdef0123456789abcdef",
      VERCEL_PROJECT_PRODUCTION_URL: "executar-ai.vercel.app",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("MCP secret contract is valid");
    expect(result.stderr).toBe("");
  });

  it("fails closed when the canonical MCP project has no secret", () => {
    const result = runGuard({
      VERCEL_PROJECT_PRODUCTION_URL: "executar-ai.vercel.app",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MCP_JWT_SECRET is required");
  });

  it("fails closed when the canonical MCP project has a short secret", () => {
    const result = runGuard({
      MCP_JWT_SECRET: "too-short",
      VERCEL_PROJECT_PRODUCTION_URL: "https://executar-ai.vercel.app",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("at least 32 bytes");
  });

  it("does not block a Journal-only project without the MCP secret", () => {
    const result = runGuard({
      VERCEL_PROJECT_PRODUCTION_URL: "executa-journal-preview.vercel.app",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("guard skipped");
    expect(result.stderr).toBe("");
  });
});
