import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const script = resolve("scripts/generate-blog-content.mjs");

async function fixture(markdown: string) {
  const root = await mkdtemp(join(tmpdir(), "executa-blog-generator-"));
  temporaryDirectories.push(root);
  const content = join(root, "content");
  const output = join(root, "generated-content.ts");
  await mkdir(content);
  await writeFile(join(content, "artigo-e2.md"), markdown, "utf8");
  await writeFile(join(content, "artigo-e2.meta.json"), JSON.stringify({
    schema_version: "1.0",
    publication_id: "PUB-TEST",
    publication_version: 1,
    content_hash: "a".repeat(64),
    slug: "artigo-e2",
    title: "Artigo da E2",
    excerpt: "Conteúdo gerado pelo pacote editorial.",
    category: "Produto",
    reading_minutes: 2,
    updated_at: "2026-07-28T10:00:00.000Z",
    cover_pattern: "steps",
    cover_label: "PREVIEW / PUB-TEST",
  }), "utf8");
  return { content, output };
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("generated editorial blog content", () => {
  it("turns the E2 Markdown package into a typed Journal post", async () => {
    const paths = await fixture(`# Artigo da E2

Introdução do pacote editorial aprovado.

## Entrega

O artigo aparece no Vercel Preview.

- branch
- commit
- PR

> O SHA deve ser o mesmo.
`);
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        BLOG_CONTENT_DIRECTORY: paths.content,
        BLOG_GENERATED_OUTPUT: paths.output,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Generated 1 editorial blog post");
    const generated = await readFile(paths.output, "utf8");
    expect(generated).toContain('"slug": "artigo-e2"');
    expect(generated).toContain('"heading": "Entrega"');
    expect(generated).toContain('"O SHA deve ser o mesmo."');
  });

  it("fails the build when the package lacks the mandatory H2", async () => {
    const paths = await fixture("# Artigo da E2\n\nConteúdo sem seção.");
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        BLOG_CONTENT_DIRECTORY: paths.content,
        BLOG_GENERATED_OUTPUT: paths.output,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("at least one H2 is required");
  });
});
