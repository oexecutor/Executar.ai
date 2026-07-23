import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlobVaultService } from "../src/lib/vault.mjs";
import { createMcpServer } from "../src/mcp-server.mjs";
import vaultImportHandler, { setVaultStoreForTesting } from "../api/vault.js";
import { adminCookie, signAdminSession } from "../src/lib/auth.mjs";
import { memoryStore } from "./helpers/memory-store.js";

/**
 * Proves the invariant "nothing outside the repository layer can create,
 * edit, move, or delete content inside _desk-os/" across every write
 * surface, not just the two the initial audit happened to name:
 *   - BlobVaultService primitives directly (putBytes/createNote/updateNote/
 *     updateFrontmatter/importBinary/move/copy/trash/restoreTrash)
 *   - the legacy obsidian_* MCP tools, end-to-end over a real MCP transport
 *   - the /api/vault/import HTTP handler (zip entries targeting _desk-os/)
 * and confirms the ONE legitimate writer (the repository layer, via
 * allowReservedPaths: true) still works.
 */

const RESERVED = "_desk-os/state/projects/prj_test.json";

function unrestrictedVault() {
  return new BlobVaultService(memoryStore());
}

describe("BlobVaultService blocks writes/moves/deletes under _desk-os/ by default", () => {
  it("blocks putBytes/putText", async () => {
    const vault = unrestrictedVault();
    await expect(vault.putText(RESERVED, "{}")).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("blocks createNote", async () => {
    const vault = unrestrictedVault();
    await expect(vault.createNote({ path: "_desk-os/evil.md", content: "x" })).rejects.toMatchObject({
      code: "PROTECTED_PATH",
    });
  });

  it("blocks importBinary", async () => {
    const vault = unrestrictedVault();
    await expect(
      vault.importBinary({ path: "_desk-os/evil.bin", dataBase64: Buffer.from("x").toString("base64") }),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("blocks updateNote and updateFrontmatter on a pre-existing state record", async () => {
    const store = memoryStore();
    const admin = new BlobVaultService(store, { allowReservedPaths: true });
    await admin.putText("_desk-os/note.md", "# state");
    const vault = new BlobVaultService(store);
    await expect(vault.updateNote({ path: "_desk-os/note.md", content: "hacked" })).rejects.toMatchObject({
      code: "PROTECTED_PATH",
    });
    await expect(vault.updateFrontmatter({ path: "_desk-os/note.md", set: { x: 1 } })).rejects.toMatchObject({
      code: "PROTECTED_PATH",
    });
  });

  it("blocks move in both directions (into and out of _desk-os/)", async () => {
    const store = memoryStore();
    const admin = new BlobVaultService(store, { allowReservedPaths: true });
    await admin.putText("_desk-os/state/x.json", "{}");
    const vault = new BlobVaultService(store);
    await vault.putText("notes/plain.md", "hello");

    await expect(vault.move({ source: "notes/plain.md", destination: "_desk-os/hijack.md" })).rejects.toMatchObject({
      code: "PROTECTED_PATH",
    });
    await expect(
      vault.move({ source: "_desk-os/state/x.json", destination: "notes/exfiltrated.json" }),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("blocks copy INTO _desk-os/ (copying out is a read, allowed)", async () => {
    const store = memoryStore();
    const admin = new BlobVaultService(store, { allowReservedPaths: true });
    await admin.putText("_desk-os/state/x.json", "{}");
    const vault = new BlobVaultService(store);
    await vault.putText("notes/plain.md", "hello");

    await expect(vault.copy({ source: "notes/plain.md", destination: "_desk-os/hijack.md" })).rejects.toMatchObject({
      code: "PROTECTED_PATH",
    });
    await expect(vault.copy({ source: "_desk-os/state/x.json", destination: "notes/copy.json" })).resolves.toMatchObject(
      { copied: true },
    );
  });

  it("blocks trash and restoreTrash targeting _desk-os/", async () => {
    const store = memoryStore();
    const admin = new BlobVaultService(store, { allowReservedPaths: true });
    await admin.putText("_desk-os/state/x.json", "{}");
    const vault = new BlobVaultService(store);

    await expect(vault.trash("_desk-os/state/x.json")).rejects.toMatchObject({ code: "PROTECTED_PATH" });

    await vault.putText("notes/plain.md", "hello");
    const trashed = await vault.trash("notes/plain.md");
    await expect(
      vault.restoreTrash({ trashId: String(trashed.trashId), destination: "_desk-os/restored.md" }),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("lets the repository layer (allowReservedPaths: true) write there", async () => {
    const admin = new BlobVaultService(memoryStore(), { allowReservedPaths: true });
    await expect(admin.putText(RESERVED, "{}")).resolves.toMatchObject({ path: RESERVED });
  });
});

describe("legacy obsidian_* MCP tools cannot reach _desk-os/ (end-to-end over MCP transport)", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];
  afterEach(async () => {
    while (closeables.length) await closeables.pop()?.close();
  });

  async function connect() {
    const store = memoryStore();
    const vault = new BlobVaultService(store);
    const server = createMcpServer(vault);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, store };
  }

  it("obsidian_create_note is rejected", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "obsidian_create_note",
      arguments: { path: "_desk-os/evil.md", content: "x" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("PROTECTED_PATH");
  });

  it("obsidian_move_entry into _desk-os/ is rejected and the store stays untouched", async () => {
    const { client, store } = await connect();
    await client.callTool({ name: "obsidian_create_note", arguments: { path: "notes/a.md", content: "x" } });
    const result = await client.callTool({
      name: "obsidian_move_entry",
      arguments: { source: "notes/a.md", destination: "_desk-os/hijacked.md" },
    });
    expect(result.isError).toBe(true);
    const keys = await store.list({ prefix: "file/" });
    expect((keys as { blobs: Array<{ key: string }> }).blobs.some((b) => b.key.includes("_desk-os"))).toBe(false);
  });

  it("obsidian_import_binary into _desk-os/ is rejected", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "obsidian_import_binary",
      arguments: { path: "_desk-os/evil.bin", dataBase64: Buffer.from("x").toString("base64") },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("PROTECTED_PATH");
  });
});

describe("/api/vault/import cannot plant files inside _desk-os/", () => {
  afterEach(() => {
    setVaultStoreForTesting(null);
    vi.unstubAllEnvs();
  });

  it("skips a zip entry targeting _desk-os/ instead of importing it", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    vi.stubEnv("PUBLIC_BASE_URL", "https://example.test");
    vi.stubEnv("MCP_JWT_SECRET", "unit-test-secret-with-at-least-32-characters!!");
    vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery");
    const cookie = adminCookie(await signAdminSession()).split(";")[0] ?? "";
    setVaultStoreForTesting(() => memoryStore());

    const archive = zipSync({
      "notes/ok.md": strToU8("# ok"),
      "_desk-os/state/projects/prj_evil.json": strToU8('{"id":"prj_evil"}'),
    });
    const response = await vaultImportHandler(
      new Request("https://example.test/api/vault/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/zip" },
        body: archive,
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { imported: number; skipped: Array<{ path: string; reason: string }> };
    expect(body.imported).toBe(1);
    expect(body.skipped.some((entry) => entry.path.startsWith("_desk-os/") && entry.reason === "reserved_path")).toBe(
      true,
    );
  });
});
