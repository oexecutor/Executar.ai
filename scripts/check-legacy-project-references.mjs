import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

const legacySlug = ["executa", "journal", "preview"].join("-");
const legacyProjectId = ["prj", "SMaYVWIDqomDGV4hYYjtwQGMAabv"].join("_");
const blockedValues = [
  `${legacySlug}.vercel.app`,
  `${legacySlug}-oexecutor-9118s-projects.vercel.app`,
  `${legacySlug}-git-main-oexecutor-9118s-projects.vercel.app`,
  legacyProjectId,
];

// Estas referências são temporárias e existem somente para manter o projeto
// legado como ponte 308 e bloquear builds até a exclusão manual na Vercel.
const temporaryAllowedPaths = new Set([
  "vercel.json",
  "scripts/vercel-ignore-duplicate.mjs",
  "docs/operations/DELETE_EXECUTA_JOURNAL_PREVIEW.md",
  "docs/operations/sql/verify-no-legacy-journal.sql",
]);

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".vercel",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolutePath);
    } else if (entry.isFile()) {
      yield absolutePath;
    }
  }
}

function relative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

async function readTextFile(absolutePath) {
  const fileStat = await stat(absolutePath);
  if (fileStat.size > MAX_TEXT_FILE_BYTES) return null;

  const buffer = await readFile(absolutePath);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

const violations = [];
const temporaryHits = [];

for await (const absolutePath of walk(ROOT)) {
  const filePath = relative(absolutePath);
  if (filePath === "scripts/check-legacy-project-references.mjs") continue;

  const content = await readTextFile(absolutePath);
  if (content === null) continue;

  for (const value of blockedValues) {
    if (!content.includes(value)) continue;

    const hit = { filePath, value };
    if (temporaryAllowedPaths.has(filePath)) {
      temporaryHits.push(hit);
    } else {
      violations.push(hit);
    }
  }
}

if (violations.length > 0) {
  console.error("Referências não autorizadas ao projeto Journal legado:");
  for (const { filePath, value } of violations) {
    console.error(`- ${filePath}: ${value}`);
  }
  process.exit(1);
}

console.log(
  `Migração Journal validada: nenhuma referência fora dos ${temporaryAllowedPaths.size} arquivos temporários autorizados.`,
);
for (const { filePath } of temporaryHits) {
  console.log(`- temporário: ${filePath}`);
}
