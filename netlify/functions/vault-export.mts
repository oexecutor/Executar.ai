import type { Config } from "@netlify/functions";
import { zipSync } from "fflate";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService } from "../../src/lib/vault.mjs";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    const files: Record<string, Uint8Array> = {};
    for (const record of await new BlobVaultService(vaultStore()).allRecords()) {
      files[`DESK-OS-OBSIDIAN/${record.path}`] = Buffer.from(record.data, "base64");
    }
    const archive = zipSync(files, { level: 6 });
    if (archive.byteLength > 6_000_000) return json({ error: "export_too_large", limitBytes: 6_000_000 }, { status: 413 });
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
};

export const config: Config = { path: "/api/vault/export" };
