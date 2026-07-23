import path from "node:path";
import { unzipSync, zipSync, type UnzipFileInfo } from "fflate";
import { requireAdminHtml, requireAdminJson } from "../src/lib/admin-guard.js";
import { baseUrl } from "../src/lib/env.js";
import { json as httpJson, methodNotAllowed, safeError } from "../src/lib/http.js";
import { vaultStore } from "../src/lib/stores.js";
import { BlobVaultService, normalizeVaultPath, VaultProblem } from "../src/lib/vault.js";
import { isDeskOsPath } from "../src/repository/paths.js";
import { buildVaultBrowserUrl, buildVaultDownloadUrl, buildVaultRawUrl, buildVaultViewUrl, contentTypeFor, isTextFile, renderMarkdown, renderViewerError } from "../src/lib/viewer.js";
import type { FileRecord } from "../src/lib/types.js";

/**
 * status/export/import/files/view live in one function, dispatched by
 * pathname, to stay under Vercel's 12-function Hobby-plan cap — see
 * api/oauth.ts and api/admin.ts for the same pattern. Each section is
 * otherwise unchanged from its own former file.
 */

async function status(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    return httpJson(await new BlobVaultService(vaultStore()).info());
  } catch (error) {
    return safeError(error);
  }
}

async function exportZip(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    const files: Record<string, Uint8Array> = {};
    for (const record of await new BlobVaultService(vaultStore()).allRecords()) {
      files[`DESK-OS-OBSIDIAN/${record.path}`] = Buffer.from(record.data, "base64");
    }
    const archive = zipSync(files, { level: 6 });
    if (archive.byteLength > 6_000_000) return httpJson({ error: "export_too_large", limitBytes: 6_000_000 }, { status: 413 });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="desk-os-obsidian-${date}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

const MAX_EDITOR_BYTES = 1_048_576;

/**
 * DESK-OS operational state (`_desk-os/`) is mutated only through the
 * repository/application services, never by the generic file editor.
 */
function rejectDeskOsWrite(requestedPath: string): void {
  if (isDeskOsPath(normalizeVaultPath(requestedPath))) {
    throw new VaultProblem(
      "RESERVED_PATH",
      "A área _desk-os/ é reservada ao estado operacional do DESK-OS.",
      "Use as ferramentas desk_os_* ou a API /api/pm/* para alterar projetos, sprints e tarefas.",
    );
  }
}

function filesJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function filesErrorStatus(error: VaultProblem): number {
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "CONFLICT") return 409;
  if (error.code === "PROTECTED_PATH") return 403;
  if (error.code === "TOO_LARGE") return 413;
  return 400;
}

function extensionOf(filePath: string): string {
  return path.posix.extname(filePath).toLowerCase();
}

function descriptor(record: FileRecord): Record<string, unknown> {
  const bytes = Buffer.from(record.data, "base64");
  const extension = extensionOf(record.path);
  const text = record.sizeBytes <= MAX_EDITOR_BYTES && isTextFile(record.path, bytes);
  return {
    path: record.path,
    name: path.posix.basename(record.path),
    extension,
    isNote: extension === ".md" || extension === ".markdown",
    isText: text,
    editable: text,
    sizeBytes: record.sizeBytes,
    modifiedAt: record.modifiedAt,
    sha256: record.sha256,
    mimeType: record.mimeType ?? contentTypeFor(record.path).split(";", 1)[0],
    originalName: record.originalName ?? null,
    viewUrl: buildVaultViewUrl(baseUrl(), record.path),
    downloadUrl: buildVaultDownloadUrl(baseUrl(), record.path),
  };
}

async function readFile(vault: BlobVaultService, requestedPath: string): Promise<Record<string, unknown>> {
  const { record, bytes } = await vault.getFileBytes(requestedPath);
  const text = record.sizeBytes <= MAX_EDITOR_BYTES && isTextFile(record.path, bytes);
  const content = text ? Buffer.from(bytes).toString("utf8") : null;
  const extension = extensionOf(record.path);
  return {
    ...descriptor(record),
    content,
    renderedHtml: content !== null && (extension === ".md" || extension === ".markdown")
      ? renderMarkdown(content, record.path, baseUrl())
      : null,
    rawUrl: text ? buildVaultRawUrl(baseUrl(), record.path) : null,
  };
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_EDITOR_BYTES + 65_536) {
    throw new VaultProblem("TOO_LARGE", "O conteúdo ultrapassa o limite do editor.", "Edite arquivos de até 1 MB por vez.");
  }
  const value = await request.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VaultProblem("INVALID_INPUT", "O corpo da requisição precisa ser um objeto JSON.", "Envie path, content e expectedSha256 quando aplicável.");
  }
  return value as Record<string, unknown>;
}

async function files(request: Request): Promise<Response> {
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  const vault = new BlobVaultService(vaultStore());
  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      const requestedPath = url.searchParams.get("path")?.trim();
      if (requestedPath) return filesJson({ file: await readFile(vault, requestedPath) });

      const records = await vault.allRecords();
      const info = await vault.info();
      return filesJson({ info, entries: records.map(descriptor) });
    }

    if (request.method === "POST") {
      const input = await parseJson(request);
      const notePath = typeof input.path === "string" ? input.path.trim() : "";
      rejectDeskOsWrite(notePath);
      const content = typeof input.content === "string" ? input.content : "";
      if (!notePath.toLowerCase().endsWith(".md")) {
        throw new VaultProblem("INVALID_INPUT", "Novos arquivos criados pelo painel precisam ser notas .md.", "Use um caminho como 00_COMECE_AQUI/Nova nota.md.");
      }
      if (Buffer.byteLength(content, "utf8") > MAX_EDITOR_BYTES) {
        throw new VaultProblem("TOO_LARGE", "A nota ultrapassa o limite do editor.", "Crie uma nota de até 1 MB.");
      }
      await vault.createNote({ path: notePath, content });
      return filesJson({ file: await readFile(vault, notePath) }, 201);
    }

    if (request.method === "PUT") {
      const input = await parseJson(request);
      const requestedPath = typeof input.path === "string" ? input.path.trim() : "";
      rejectDeskOsWrite(requestedPath);
      const content = typeof input.content === "string" ? input.content : null;
      const expectedSha256 = typeof input.expectedSha256 === "string" ? input.expectedSha256 : "";
      if (!requestedPath || content === null) {
        throw new VaultProblem("INVALID_INPUT", "path e content são obrigatórios.", "Leia o arquivo antes de salvá-lo e preserve expectedSha256.");
      }
      if (Buffer.byteLength(content, "utf8") > MAX_EDITOR_BYTES) {
        throw new VaultProblem("TOO_LARGE", "O conteúdo ultrapassa o limite do editor.", "Edite arquivos de até 1 MB por vez.");
      }
      if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new VaultProblem("INVALID_INPUT", "expectedSha256 é obrigatório e precisa ser válido.", "Use o hash retornado pela leitura mais recente.");
      }
      const current = await vault.getFileBytes(requestedPath);
      if (current.record.sizeBytes > MAX_EDITOR_BYTES || !isTextFile(current.record.path, current.bytes)) {
        throw new VaultProblem("INVALID_INPUT", "Este arquivo não pode ser editado como texto no painel.", "Use download para arquivos binários ou maiores que 1 MB.");
      }
      if (requestedPath.toLowerCase().endsWith(".md")) {
        await vault.updateNote({ path: requestedPath, content, mode: "replace", expectedSha256 });
      } else {
        await vault.updateTextFile({ path: requestedPath, content, expectedSha256 });
      }
      return filesJson({ file: await readFile(vault, requestedPath) });
    }

    return filesJson({ error: { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." } }, 405);
  } catch (error) {
    if (error instanceof VaultProblem) {
      return filesJson({ error: { code: error.code, message: error.message, suggestion: error.suggestion } }, filesErrorStatus(error));
    }
    console.error(error instanceof Error ? error.message : String(error));
    return filesJson({ error: { code: "SERVER_ERROR", message: "O navegador do vault encontrou um erro inesperado." } }, 500);
  }
}

const MAX_ARCHIVE_BYTES = 6_000_000;
const MAX_FILES = 2_000;
const MAX_UNCOMPRESSED_BYTES = 50_000_000;
const MAX_SINGLE_FILE_BYTES = 5_000_000;

/**
 * Zip-bomb guard (baseline §11.3): the previous code called `unzipSync`
 * with no options, which fully inflates every entry into memory before any
 * per-file/per-total size check ran — a 6MB (MAX_ARCHIVE_BYTES) upload can
 * legally decompress to gigabytes. fflate's `filter` runs against each
 * entry's DECLARED size from the zip's central directory before that entry
 * is inflated, so rejecting here means the bytes are never allocated at
 * all, not just discarded afterward. Zero-byte directory markers are kept
 * so the existing "single root folder" stripping below still works.
 */
function evaluateEntries(compressed: Uint8Array) {
  let totalDeclaredBytes = 0;
  let acceptedFileCount = 0;
  let uncompressedBudgetExceeded = false;
  let fileCountExceeded = false;
  const oversizedRawNames: string[] = [];

  const archive = unzipSync(compressed, {
    filter(file: UnzipFileInfo): boolean {
      if (file.name.endsWith("/")) return true;
      if (uncompressedBudgetExceeded || fileCountExceeded) return false;
      if (file.originalSize > MAX_SINGLE_FILE_BYTES) {
        oversizedRawNames.push(file.name);
        return false;
      }
      totalDeclaredBytes += file.originalSize;
      if (totalDeclaredBytes > MAX_UNCOMPRESSED_BYTES) {
        uncompressedBudgetExceeded = true;
        return false;
      }
      acceptedFileCount += 1;
      if (acceptedFileCount > MAX_FILES) {
        fileCountExceeded = true;
        return false;
      }
      return true;
    },
  });

  return { archive, uncompressedBudgetExceeded, fileCountExceeded, oversizedRawNames };
}

let storeFactory = vaultStore;

/** Tests inject an in-memory store; production uses Vercel Postgres. */
export function setVaultStoreForTesting(factory: typeof vaultStore | null): void {
  storeFactory = factory ?? vaultStore;
}

async function importZip(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    const compressed = new Uint8Array(await request.arrayBuffer());
    if (compressed.byteLength > MAX_ARCHIVE_BYTES) return httpJson({ error: "archive_too_large", limitBytes: MAX_ARCHIVE_BYTES }, { status: 413 });

    const { archive, uncompressedBudgetExceeded, fileCountExceeded, oversizedRawNames } = evaluateEntries(compressed);
    if (uncompressedBudgetExceeded) return httpJson({ error: "uncompressed_archive_too_large" }, { status: 413 });
    if (fileCountExceeded) return httpJson({ error: "too_many_files", limit: MAX_FILES }, { status: 413 });

    const archivePaths = Object.keys(archive);
    const explicitRoot = archivePaths.find((value) => value.endsWith("/") && !value.slice(0, -1).includes("/"))?.slice(0, -1);
    const candidates: Array<{ path: string; bytes: Uint8Array }> = [];
    const skipped: Array<{ path: string; reason: string }> = oversizedRawNames.map((name) => ({
      path: name,
      reason: "file_too_large",
    }));
    let totalBytes = 0;
    for (const [rawPath, bytes] of Object.entries(archive)) {
      if (rawPath.endsWith("/") || bytes.byteLength === 0) continue;
      if (rawPath === "__MACOSX" || rawPath.startsWith("__MACOSX/")) { skipped.push({ path: rawPath, reason: "system_metadata" }); continue; }
      const withoutRoot = explicitRoot && rawPath.startsWith(`${explicitRoot}/`) ? rawPath.slice(explicitRoot.length + 1) : rawPath;
      try {
        const normalized = normalizeVaultPath(withoutRoot);
        if (isDeskOsPath(normalized)) { skipped.push({ path: normalized, reason: "reserved_path" }); continue; }
        totalBytes += bytes.byteLength;
        candidates.push({ path: normalized, bytes });
      } catch (error) {
        skipped.push({ path: rawPath, reason: error instanceof VaultProblem ? error.code : "invalid_path" });
      }
    }
    const vault = new BlobVaultService(storeFactory());
    let created = 0;
    let updated = 0;
    for (const candidate of candidates) {
      try { await vault.getRecord(candidate.path); updated += 1; }
      catch { created += 1; }
      await vault.putBytes(candidate.path, candidate.bytes);
    }
    return httpJson({ imported: candidates.length, created, updated, skipped, mode: "safe_merge", totalBytes });
  } catch (error) {
    return safeError(error);
  }
}

function viewHtml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function downloadName(filePath: string): string {
  return filePath.split("/").at(-1) ?? "arquivo";
}

async function view(request: Request): Promise<Response> {
  const denied = await requireAdminHtml(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("path")?.trim();
  const vault = new BlobVaultService(vaultStore());

  try {
    if (!requestedPath) return Response.redirect(buildVaultBrowserUrl(baseUrl()), 302);

    const { record, bytes } = await vault.getFileBytes(requestedPath);
    if (url.searchParams.get("download") === "1") {
      return new Response(bytes, {
        headers: {
          "Content-Type": record.mimeType ?? contentTypeFor(record.path),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName(record.path))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (url.searchParams.get("raw") === "1") {
      if (!isTextFile(record.path, bytes)) return viewHtml(renderViewerError(415, "Este arquivo não é texto legível."), 415);
      return new Response(bytes, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(downloadName(record.path))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return Response.redirect(buildVaultViewUrl(baseUrl(), record.path), 302);
  } catch (error) {
    if (error instanceof VaultProblem) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return viewHtml(renderViewerError(status, `${error.message} ${error.suggestion}`), status);
    }
    console.error(error instanceof Error ? error.message : String(error));
    return viewHtml(renderViewerError(500, "O visualizador encontrou um erro inesperado."), 500);
  }
}

export default async (request: Request): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/vault/status") return status(request);
  if (pathname === "/api/vault/export") return exportZip(request);
  if (pathname === "/api/vault/import") return importZip(request);
  if (pathname === "/api/vault/files") return files(request);
  if (pathname === "/view") return view(request);
  return httpJson({ error: "not_found" }, { status: 404 });
};
