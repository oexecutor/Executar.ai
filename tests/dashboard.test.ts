import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("integrated dashboard interface", () => {
  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

  it("keeps the dashboard and exposes notes and documents tabs", () => {
    expect(html).toContain('data-tab="dashboard"');
    expect(html).toContain('data-tab="notes"');
    expect(html).toContain('data-tab="documents"');
    expect(html).toContain('id="projectGrid"');
    expect(html).toContain('id="workflowDashboardGrid"');
    expect(html).toContain("desk_ingest_workflow_dashboard");
  });

  it("uses the vault files API for read, create, and edit", () => {
    expect(html).toContain('api("/api/vault/files")');
    expect(html).toContain('method: "POST"');
    expect(html).toContain('method: "PUT"');
    expect(html).toContain("expectedSha256");
    expect(html).toContain('id="fileEditor"');
  });
  it("opens the workspace without a password form", () => {
    expect(html).toContain("ACESSO ABERTO");
    expect(html).not.toContain('id="loginSection"');
    expect(html).not.toContain("Senha administrativa");
  });

});
