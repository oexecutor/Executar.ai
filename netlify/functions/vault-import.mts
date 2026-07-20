import type { Config } from "@netlify/functions";
import { unzipSync } from "fflate";
import { requireAdminJson } from "../../src/lib/admin-guard.mjs";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService, normalizeVaultPath, VaultProblem } from "../../src/lib/vault.mjs";

const MAX_ARCHIVE_BYTES = 6_000_000;
const MAX_FILES = 2_000;
const MAX_UNCOMPRESSED_BYTES = 50_000_000;
const MAX_SINGLE_FILE_BYTES = 5_000_000;

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    const compressed = new Uint8Array(await request.arrayBuffer());
    if (compressed.byteLength > MAX_ARCHIVE_BYTES) return json({ error: "archive_too_large", limitBytes: MAX_ARCHIVE_BYTES }, { status: 413 });
    const archive = unzipSync(compressed);
    const archivePaths = Object.keys(archive);
    const explicitRoot = archivePaths.find((value) => value.endsWith("/") && !value.slice(0, -1).includes("/"))?.slice(0, -1);
    const candidates: Array<{ path: string; bytes: Uint8Array }> = [];
    const skipped: Array<{ path: string; reason: string }> = [];
    let totalBytes = 0;
    for (const [rawPath, bytes] of Object.entries(archive)) {
      if (rawPath.endsWith("/") || bytes.byteLength === 0) continue;
      if (rawPath === "__MACOSX" || rawPath.startsWith("__MACOSX/")) { skipped.push({ path: rawPath, reason: "system_metadata" }); continue; }
      const withoutRoot = explicitRoot && rawPath.startsWith(`${explicitRoot}/`) ? rawPath.slice(explicitRoot.length + 1) : rawPath;
      try {
        const normalized = normalizeVaultPath(withoutRoot);
        if (bytes.byteLength > MAX_SINGLE_FILE_BYTES) { skipped.push({ path: normalized, reason: "file_too_large" }); continue; }
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_UNCOMPRESSED_BYTES) return json({ error: "uncompressed_archive_too_large" }, { status: 413 });
        candidates.push({ path: normalized, bytes });
      } catch (error) {
        skipped.push({ path: rawPath, reason: error instanceof VaultProblem ? error.code : "invalid_path" });
      }
    }
    if (candidates.length > MAX_FILES) return json({ error: "too_many_files", limit: MAX_FILES }, { status: 413 });
    const vault = new BlobVaultService(vaultStore());
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
