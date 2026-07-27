import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/migrate-editorial.mjs");
const connectionNames = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

function run(projectName?: string, args: string[] = []) {
  const env = { ...process.env };
  for (const name of connectionNames) delete env[name];
  if (projectName === undefined) delete env.VERCEL_PROJECT_NAME;
  else env.VERCEL_PROJECT_NAME = projectName;
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
}

describe("editorial migration build guard", () => {
  it("does not require the database for Journal-only projects", () => {
    const result = run("executa-journal-preview");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipped for non-canonical project");
  });

  it("does not block ordinary local builds without runtime configuration", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipped outside the canonical Vercel project");
  });

  it("fails closed for the canonical project or an explicit migration run", () => {
    const canonical = run("executar-ai");
    expect(canonical.status).not.toBe(0);
    expect(canonical.stderr).toContain("Editorial migration requires one of");

    const explicit = run(undefined, ["--require"]);
    expect(explicit.status).not.toBe(0);
    expect(explicit.stderr).toContain("Editorial migration requires one of");
  });
});
