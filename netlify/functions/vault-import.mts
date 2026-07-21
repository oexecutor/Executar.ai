import type { Config } from "@netlify/functions";
import { unzipSync, type UnzipFileInfo } from "fflate";
import { requireAdminJson } from "../../src/lib/admin-guard.mjs";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService, normalizeVaultPath, VaultProblem } from "../../src/lib/vault.mjs";
import { isDeskOsPath } from "../../src/repository/paths.mjs";

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

/** Tests inject an in-memory store; production uses Netlify Blobs. */
export function setVaultStoreForTesting(factory: typeof vaultStore | null): void {
  storeFactory = factory ?? vaultStore;
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    const compressed = new Uint8Array(await request.arrayBuffer());
    if (compressed.byteLength > MAX_ARCHIVE_BYTES) return json({ error: "archive_too_large", limitBytes: MAX_ARCHIVE_BYTES }, { status: 413 });

    const { archive, uncompressedBudgetExceeded, fileCountExceeded, oversizedRawNames } = evaluateEntries(compressed);
    if (uncompressedBudgetExceeded) return json({ error: "uncompressed_archive_too_large" }, { status: 413 });
    if (fileCountExceeded) return json({ error: "too_many_files", limit: MAX_FILES }, { status: 413 });

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
    return json({ imported: candidates.length, created, updated, skipped, mode: "safe_merge", totalBytes });
  } catch (error) {
    return safeError(error);
  }
};

export const config: Config = { path: "/api/vault/import" };
