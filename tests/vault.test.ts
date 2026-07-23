import type { KvStore as Store } from "../src/lib/kv-store.js";
import { describe, expect, it } from "vitest";
import { BlobVaultService, normalizeVaultPath } from "../src/lib/vault.js";

function memoryStore(): Store {
  const values = new Map<string, unknown>();
  return {
    async set(key: string, value: unknown) { values.set(key, value); },
    async setJSON(key: string, value: unknown) { values.set(key, structuredClone(value)); },
    async get(key: string) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async getWithMetadata() { return null; },
    async getMetadata() { return null; },
    async list(options?: { prefix?: string }) {
      return { blobs: [...values.keys()].filter((key) => !options?.prefix || key.startsWith(options.prefix)).map((key) => ({ key, etag: "test" })), directories: [] };
    },
    async delete(key: string) { values.delete(key); },
  } as unknown as Store;
}

describe("remote vault", () => {
  it("normalizes safe paths and rejects protected paths", () => {
    expect(normalizeVaultPath("Projects\\Plan.md")).toBe("Projects/Plan.md");
    expect(() => normalizeVaultPath("../secret.md")).toThrow(/inside the vault/);
    expect(() => normalizeVaultPath(".obsidian/app.json")).toThrow(/protected/);
  });

  it("creates, reads, updates, trashes, and restores a note", async () => {
    const vault = new BlobVaultService(memoryStore());
    const created = await vault.createNote({ path: "Projects/Plan.md", content: "# Plan", frontmatter: { status: "draft" } });
    const first = await vault.read("Projects/Plan.md");
    expect(first.frontmatter).toEqual({ status: "draft" });

    await vault.updateNote({ path: "Projects/Plan.md", content: "\nNext action", mode: "append", expectedSha256: String(created.sha256) });
    expect(String((await vault.read("Projects/Plan.md")).content)).toContain("Next action");

    const trashed = await vault.trash("Projects/Plan.md");
    expect((await vault.listTrash()).items).toHaveLength(1);
    await vault.restoreTrash({ trashId: String(trashed.trashId) });
    expect(String((await vault.read("Projects/Plan.md")).content)).toContain("Next action");
  });

  it("updates non-Markdown text documents with revision protection", async () => {
    const vault = new BlobVaultService(memoryStore());
    await vault.putText("References/data.csv", "name,value\nA,1");
    const first = await vault.read("References/data.csv");
    await vault.updateTextFile({ path: "References/data.csv", content: "name,value\nA,2", expectedSha256: String(first.sha256) });
    expect(String((await vault.read("References/data.csv")).content)).toContain("A,2");
    await expect(vault.updateTextFile({ path: "References/data.csv", content: "stale", expectedSha256: String(first.sha256) })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("protects against stale revision writes", async () => {
    const vault = new BlobVaultService(memoryStore());
    await vault.createNote({ path: "Note.md", content: "one" });
    const read = await vault.read("Note.md");
    await vault.updateNote({ path: "Note.md", content: "two", expectedSha256: String(read.sha256) });
    await expect(vault.updateNote({ path: "Note.md", content: "three", expectedSha256: String(read.sha256) })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("imports binary bytes with checksum and safe overwrite protection", async () => {
    const vault = new BlobVaultService(memoryStore());
    const firstBytes = Buffer.from([0, 1, 2, 3, 255]);
    const created = await vault.importBinary({
      path: "Skills/package.zip",
      dataBase64: firstBytes.toString("base64"),
      mimeType: "application/zip",
      expectedContentSha256: "ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e",
    });
    expect(created).toMatchObject({ imported: true, replaced: false, sizeBytes: 5, mimeType: "application/zip" });
    const stored = await vault.getFileBytes("Skills/package.zip");
    expect(Buffer.from(stored.bytes)).toEqual(firstBytes);

    await expect(vault.importBinary({
      path: "Skills/package.zip",
      dataBase64: Buffer.from("replacement").toString("base64"),
      overwrite: true,
      expectedSha256: "0".repeat(64),
    })).rejects.toMatchObject({ code: "CONFLICT" });

    await vault.importBinary({
      path: "Skills/package.zip",
      dataBase64: Buffer.from("replacement").toString("base64"),
      overwrite: true,
      expectedSha256: stored.record.sha256,
    });
    expect(Buffer.from((await vault.getFileBytes("Skills/package.zip")).bytes).toString()).toBe("replacement");
    expect((await vault.listTrash()).items).toHaveLength(1);
  });

});
