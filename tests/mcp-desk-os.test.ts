import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { DeskOsService } from "../src/application/desk-os-service.js";
import { createDeskOsRepositories } from "../src/repository/vault-adapter.js";
import { BlobVaultService } from "../src/lib/vault.js";
import { createMcpServer } from "../src/mcp-server.js";
import { memoryStore } from "./helpers/memory-store.js";

async function connectedClient() {
  const store = memoryStore();
  const vault = new BlobVaultService(store);
  const service = new DeskOsService(createDeskOsRepositories(store), vault);
  const server = createMcpServer(vault, {
    publicBaseUrl: "https://example.test",
    deskOsService: service,
    actorId: "client_test",
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server, service };
}

function structured(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  return (result.structuredContent as { result: Record<string, unknown> }).result;
}

describe("desk_os_* MCP catalog (Gate 4)", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];
  afterEach(async () => {
    while (closeables.length) await closeables.pop()?.close();
  });

  it("registers the 18 desk_os_* tools ADDITIVELY next to the 19 legacy tools", async () => {
    const { client, server } = await connectedClient();
    closeables.push(client, server);
    const catalog = await client.listTools();
    const names = catalog.tools.map((tool) => tool.name);
    expect(names).toHaveLength(37);
    expect(names.filter((name) => name.startsWith("desk_os_"))).toHaveLength(18);
    expect(names).toEqual(
      expect.arrayContaining([
        "obsidian_vault_info",
        "desk_ingest_workflow_dashboard",
        "desk_os_get_today",
        "desk_os_apply_decomposition",
      ]),
    );
  });

  it("runs a full PM cycle through MCP tools against the canonical state", async () => {
    const { client, server } = await connectedClient();
    closeables.push(client, server);

    const created = await client.callTool({
      name: "desk_os_create_project",
      arguments: {
        idempotency_key: "k1",
        title: "Evoluir MCP",
        objective: "PM sobre o vault",
        definition_of_done: ["Kanban funciona"],
      },
    });
    expect(created.isError).not.toBe(true);
    const project = structured(created).data as { id: string };

    const sprint = structured(
      await client.callTool({
        name: "desk_os_create_sprint",
        arguments: {
          project_id: project.id,
          title: "S1",
          goal: "Núcleo",
          start_date: "2026-07-20",
          end_date: "2026-07-24",
          idempotency_key: "k2",
        },
      }),
    ).data as { id: string };

    const task = structured(
      await client.callTool({
        name: "desk_os_create_task",
        arguments: {
          project_id: project.id,
          sprint_id: sprint.id,
          title: "Implementar board",
          outcome: "Board lê o índice",
          steps: [{ title: "colunas" }],
          idempotency_key: "k3",
        },
      }),
    ).data as { id: string };

    await client.callTool({
      name: "desk_os_move_task",
      arguments: { task_id: task.id, target_status: "READY", target_position: 1, expected_version: 1, idempotency_key: "k4" },
    });

    const board = structured(
      await client.callTool({ name: "desk_os_get_board", arguments: { sprint_id: sprint.id } }),
    ).data as { columns: Array<{ status: string; tasks: unknown[] }> };
    expect(board.columns.find((column) => column.status === "READY")?.tasks).toHaveLength(1);

    const today = structured(
      await client.callTool({ name: "desk_os_get_today", arguments: { date: "2026-07-21" } }),
    ).data as { nextAction: { id: string } };
    expect(today.nextAction.id).toBe(task.id);
  });

  it("read tools do not mutate state (Gate 4 acceptance)", async () => {
    const { client, server, service } = await connectedClient();
    closeables.push(client, server);
    await client.callTool({ name: "desk_os_get_system_status", arguments: {} });
    await client.callTool({ name: "desk_os_list_projects", arguments: {} });
    expect(await service.recentAudit()).toHaveLength(0);
  });

  it("apply requires explicit approval and returns a typed error otherwise", async () => {
    const { client, server } = await connectedClient();
    closeables.push(client, server);
    const project = structured(
      await client.callTool({
        name: "desk_os_create_project",
        arguments: { idempotency_key: "k1", title: "P", objective: "o", definition_of_done: ["d"] },
      }),
    ).data as { id: string };
    const proposal = structured(
      await client.callTool({
        name: "desk_os_prepare_decomposition",
        arguments: {
          project_id: project.id,
          proposal: { changes: { taskDrafts: [{ title: "T", outcome: "O" }] } },
          idempotency_key: "k2",
        },
      }),
    ).data as { id: string };

    const denied = await client.callTool({
      name: "desk_os_apply_decomposition",
      arguments: { proposal_id: proposal.id, expected_version: 1, approved_by_user: false, idempotency_key: "k3" },
    });
    expect(denied.isError).toBe(true);
    const text = (denied.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("APPROVAL_REQUIRED");
  });
});
