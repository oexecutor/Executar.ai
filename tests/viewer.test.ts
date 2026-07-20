import { describe, expect, it } from "vitest";
import { buildVaultViewUrl, renderMarkdown, renderVaultBrowser, renderVaultFile } from "../src/lib/viewer.mjs";
import type { FileRecord } from "../src/lib/types.mjs";

describe("secure vault viewer", () => {
  const baseUrl = "https://desk-os-vault-mcp-openai.netlify.app";

  it("builds encoded permanent viewer links", () => {
    expect(buildVaultViewUrl(baseUrl, "Projects/Plano semanal.md")).toBe(
      "https://desk-os-vault-mcp-openai.netlify.app/?tab=notes&path=Projects%2FPlano%20semanal.md",
    );
    expect(buildVaultViewUrl(baseUrl, "References/Manual.pdf")).toBe(
      "https://desk-os-vault-mcp-openai.netlify.app/?tab=documents&path=References%2FManual.pdf",
    );
  });

  it("renders markdown and escapes raw HTML", () => {
    const html = renderMarkdown("# Título\n\n<script>alert(1)</script>\n\n- [x] Concluído\n\n[[Projects/Plano|Abrir plano]]", "Index.md", baseUrl);
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("type=\"checkbox\" disabled checked");
    expect(html).toContain("/?tab=notes&amp;path=Projects%2FPlano.md");
  });

  it("renders a searchable browser and a readable file page", () => {
    const record: FileRecord = {
      path: "Projects/Plan.md",
      data: Buffer.from("# Plan", "utf8").toString("base64"),
      sizeBytes: 6,
      sha256: "a".repeat(64),
      modifiedAt: "2026-07-18T23:00:00.000Z",
    };
    const browser = renderVaultBrowser([record], baseUrl);
    expect(browser).toContain("Projects/Plan.md");
    expect(browser).toContain("/?tab=notes&amp;path=Projects%2FPlan.md");

    const page = renderVaultFile({ record, bytes: Buffer.from("# Plan", "utf8"), publicBaseUrl: baseUrl });
    expect(page).toContain("<h1>Plan</h1>");
    expect(page).toContain("TEXTO BRUTO");
    expect(page).toContain("BAIXAR");
  });
});
