import { zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import vaultImportHandler, { setVaultStoreForTesting } from "../api/vault.js";
import { adminCookie, signAdminSession } from "../src/lib/auth.mjs";
import { memoryStore } from "./helpers/memory-store.js";

/**
 * baseline §11.3: unzipSync used to inflate every entry into memory before
 * any per-file/per-total size check ran, so a small compressed upload
 * could legally decompress to gigabytes. These tests prove the fix
 * (fflate's pre-inflation `filter`, based on declared size) actually
 * blocks a realistic high-ratio bomb — and stays fast doing it — while
 * ordinary imports and the existing per-file "skip, don't abort" UX for
 * one oversized file keep working.
 */

async function authenticatedImport(archive: Uint8Array): Promise<Response> {
  vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery");
  const cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
  setVaultStoreForTesting(() => memoryStore());
  return vaultImportHandler(
    new Request("https://example.test/api/vault/import", {
      method: "POST",
      headers: { cookie, "content-type": "application/zip" },
      body: archive as BodyInit,
    }),
  );
}

afterEach(() => {
  setVaultStoreForTesting(null);
  vi.unstubAllEnvs();
});

describe("zip-bomb guard", () => {
  it("rejects a realistic high-ratio bomb (200MB declared, ~200KB compressed) without inflating it", async () => {
    // A real zip bomb: mostly-zero content compresses ~1000:1, so this is
    // well under the 6MB upload cap yet declares 200MB uncompressed. A
    // single 200MB entry trips the per-file cap (5MB) before it ever
    // reaches the running-total budget, so it is skipped (not a wholesale
    // 413 abort) — imported: 0, nothing written to the store.
    const bomb = new Uint8Array(200 * 1024 * 1024);
    const archive = zipSync({ "bomb.bin": bomb }, { level: 9 });
    expect(archive.byteLength).toBeLessThan(6_000_000);

    const started = Date.now();
    const response = await authenticatedImport(archive);
    const elapsedMs = Date.now() - started;

    expect(response.status).toBe(200);
    const body = (await response.json()) as { imported: number; skipped: Array<{ path: string; reason: string }> };
    expect(body.imported).toBe(0);
    expect(body.skipped).toContainEqual({ path: "bomb.bin", reason: "file_too_large" });
    // If this were actually inflated (200MB allocate + copy), it would not
    // finish in well under a second even on fast hardware.
    expect(elapsedMs).toBeLessThan(1_000);
  });

  it("skips one oversized file (>5MB declared) but still imports the rest of the archive", async () => {
    const oversized = new Uint8Array(6 * 1024 * 1024);
    const archive = zipSync({
      "notes/ok.md": new TextEncoder().encode("# ok"),
      "attachments/too-big.bin": oversized,
    });
    const response = await authenticatedImport(archive);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { imported: number; skipped: Array<{ path: string; reason: string }> };
    expect(body.imported).toBe(1);
    expect(body.skipped).toContainEqual({ path: "attachments/too-big.bin", reason: "file_too_large" });
  });

  it("rejects a bomb built from many under-cap files once their combined declared size exceeds the 50MB budget", async () => {
    // Fifteen 4MB all-zero files: each is individually under the 5MB
    // per-file cap (so the per-file check alone would let them through),
    // but they sum to 60MB, over the 50MB total budget — and each
    // compresses to almost nothing, making this a real high-ratio bomb.
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 15; i++) {
      files[`data/file-${i}.bin`] = new Uint8Array(4 * 1024 * 1024);
    }
    const archive = zipSync(files, { level: 9 });
    expect(archive.byteLength).toBeLessThan(200_000);

    const started = Date.now();
    const response = await authenticatedImport(archive);
    const elapsedMs = Date.now() - started;

    const body = (await response.json()) as { error?: string };
    expect(response.status).toBe(413);
    expect(body.error).toBe("uncompressed_archive_too_large");
    expect(elapsedMs).toBeLessThan(1_000);
  });

  it("still imports a normal small archive", async () => {
    const archive = zipSync({
      "notes/a.md": new TextEncoder().encode("# A"),
      "notes/sub/b.md": new TextEncoder().encode("# B"),
    });
    const response = await authenticatedImport(archive);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { imported: number; created: number };
    expect(body.imported).toBe(2);
    expect(body.created).toBe(2);
  });
});
