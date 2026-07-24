import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase 4 React surfaces", () => {
  const landing = fs.readFileSync(new URL("../web/src/Landing.tsx", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../web/src/App.tsx", import.meta.url), "utf8");
  const documents = fs.readFileSync(new URL("../web/src/pages/Documents.tsx", import.meta.url), "utf8");
  const login = fs.readFileSync(new URL("../web/src/pages/Login.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");

  it("ships a public product landing and the authenticated workspace separately", () => {
    expect(landing).toContain("window.location.replace(\"/app\")");
    expect(landing).toContain("boot-screen");
    expect(app).toContain("<Overview");
    expect(app).toContain("<ProjectWorkspace");
    expect(app).toContain("<Board");
    expect(app).toContain("<Documents");
  });

  it("keeps vault documents in the authenticated React workspace", () => {
    expect(documents).toContain('fetch("/api/vault/files"');
    expect(documents).toContain('method: "POST"');
    expect(documents).toContain("apiAuthHeaders");
    expect(documents).toContain("Projetos/${project.id}");
  });

  it("uses Supabase account/workspace login and the approved visual identity", () => {
    expect(login).toContain("Supabase Auth + RLS");
    expect(login).toContain("loadMemberships");
    expect(login).not.toContain("Senha do operador");
    expect(styles).toContain("--canvas: #efefeb");
    expect(styles).toContain("--orange: #ff5a00");
    expect(styles).toContain("--black: #0c0c0c");
    expect(styles).toContain("--white: #ffffff");
  });
});
