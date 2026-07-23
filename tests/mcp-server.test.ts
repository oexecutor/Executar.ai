import type { KvStore as Store } from "../src/lib/kv-store.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { BlobVaultService } from "../src/lib/vault.js";
import { createMcpServer } from "../src/mcp-server.js";

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

describe("MCP tool catalog", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];
  afterEach(async () => {
    while (closeables.length) await closeables.pop()?.close();
  });

  it("exposes thirteen vault tools and six DESK-OS workflow tools", async () => {
    const server = createMcpServer(new BlobVaultService(memoryStore()));
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const catalog = await client.listTools();
    const names = catalog.tools.map((tool) => tool.name);
    expect(names).toHaveLength(19);
    expect(names).toEqual(expect.arrayContaining([
      "obsidian_import_binary",
      "desk_material_to_project",
      "desk_daily_next_action",
      "desk_evidence_to_decision",
      "desk_multisystem_dashboard",
      "desk_ingest_workflow_dashboard",
      "desk_paper_to_digital",
    ]));
  });
  it("returns clickable HTTPS links for vault files", async () => {
    const vault = new BlobVaultService(memoryStore());
    await vault.createNote({ path: "Projects/Plan.md", content: "# Plan" });
    const server = createMcpServer(vault, { publicBaseUrl: "https://desk-os-vault-mcp-openai.netlify.app" });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "obsidian_list_entries", arguments: { recursive: true, kind: "note" } });
    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((item) => item.type === "text")?.text ?? "";
    expect(text).toContain("[Navegar por todos os arquivos](https://desk-os-vault-mcp-openai.netlify.app/?tab=notes)");
    expect(text).toContain("[Projects/Plan.md](https://desk-os-vault-mcp-openai.netlify.app/?tab=notes&path=Projects%2FPlan.md)");
    expect(result.structuredContent).toMatchObject({
      result: {
        vaultBrowserUrl: "https://desk-os-vault-mcp-openai.netlify.app/?tab=notes",
        entries: [{ path: "Projects/Plan.md", viewUrl: "https://desk-os-vault-mcp-openai.netlify.app/?tab=notes&path=Projects%2FPlan.md" }],
      },
    });
  });

  it("imports an exact ZIP payload through the MCP binary tool", async () => {
    const vault = new BlobVaultService(memoryStore());
    const server = createMcpServer(vault, { publicBaseUrl: "https://desk-os-vault-mcp-openai.netlify.app" });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const zipBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x44, 0x45, 0x53, 0x4b]);
    const result = await client.callTool({
      name: "obsidian_import_binary",
      arguments: {
        path: "98_MODELOS/Skills/sample-skill.zip",
        dataBase64: zipBytes.toString("base64"),
        mimeType: "application/zip",
        originalName: "sample-skill.zip",
      },
    });
    expect(result.isError).not.toBe(true);
    const stored = await vault.getFileBytes("98_MODELOS/Skills/sample-skill.zip");
    expect(Buffer.from(stored.bytes)).toEqual(zipBytes);
    expect(stored.record.mimeType).toBe("application/zip");
    expect(stored.record.originalName).toBe("sample-skill.zip");
  });

});
