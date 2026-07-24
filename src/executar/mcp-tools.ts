import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ExecutarService } from "./service.js";

const outputSchema = { result: z.object({}).passthrough() };
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const CREATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

function result(data: unknown) {
  const normalized = typeof data === "object" && data !== null && !Array.isArray(data) ? data : { items: data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }],
    structuredContent: { result: normalized as Record<string, unknown> },
  };
}

function guard<T extends Record<string, unknown>>(action: (input: T) => Promise<unknown> | unknown) {
  return async (input: T) => {
    try {
      return result(await action(input));
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: {
              code: error && typeof error === "object" && "code" in error ? String(error.code) : "SERVER_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          }, null, 2),
        }],
      };
    }
  };
}

export function registerExecutarTools(server: McpServer, service: ExecutarService): void {
  server.registerTool("executar_list_projects", {
    title: "Listar projetos EXECUTA",
    description: "Lista os projetos canônicos 3 fases → 9 áreas → 36 itens do workspace atual.",
    inputSchema: {},
    outputSchema,
    annotations: READ,
  }, guard(async () => ({ projects: await service.listProjects() })));

  server.registerTool("executar_validate_project", {
    title: "Validar projeto EXECUTA",
    description: "Valida um project.json contra o contrato canônico 3–9–36 sem persistir.",
    inputSchema: { project_json: z.string().min(2) },
    outputSchema,
    annotations: READ,
  }, guard(async ({ project_json }) => service.validate(JSON.parse(project_json as string))));

  server.registerTool("executar_create_project", {
    title: "Criar projeto EXECUTA",
    description: "Cria um projeto canônico a partir de um project_json completo ou de nome e contexto. A estrutura é persistida no mesmo workspace usado pelo aplicativo.",
    inputSchema: {
      name: z.string().min(1).max(180).optional(),
      description: z.string().min(1).max(12_000).optional(),
      owner: z.string().max(180).optional(),
      project_json: z.string().optional(),
    },
    outputSchema,
    annotations: CREATE,
  }, guard(async (input) => service.createProject({
    project: input.project_json ? JSON.parse(input.project_json as string) : undefined,
    name: input.name as string | undefined,
    description: input.description as string | undefined,
    owner: input.owner as string | undefined,
  })));

  server.registerTool("executar_get_project", {
    title: "Obter projeto EXECUTA",
    description: "Retorna projeto, progresso e status. Uma seção opcional reduz a resposta.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      section: z.enum(["meta", "phases", "areas", "final_deliverables"]).optional(),
    },
    outputSchema,
    annotations: READ,
  }, guard(async ({ project_id, section }) => {
    const bundle = await service.getProject(project_id as string);
    return section ? { section, data: bundle.project[section as keyof typeof bundle.project] } : bundle;
  }));

  server.registerTool("executar_get_status", {
    title: "Status do projeto EXECUTA",
    description: "Retorna progresso de ações, itens, checkpoints, fases, entregáveis e ponteiro atual.",
    inputSchema: { project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/) },
    outputSchema,
    annotations: READ,
  }, guard(async ({ project_id }) => service.getStatus(project_id as string)));

  server.registerTool("executar_get_next_tasks", {
    title: "Próximas tarefas EXECUTA",
    description: "Retorna os próximos itens pendentes em ordem de execução.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      max: z.number().int().min(1).max(20).optional().default(5),
    },
    outputSchema,
    annotations: READ,
  }, guard(async ({ project_id, max }) => service.getNext(project_id as string, max as number)));

  server.registerTool("executar_complete_action", {
    title: "Concluir ação EXECUTA",
    description: "Marca ou reabre uma ação atômica como T02.1.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      action_id: z.string().regex(/^T\d{2}\.[1-3]$/),
      done: z.boolean().optional().default(true),
    },
    outputSchema,
    annotations: WRITE,
  }, guard(async ({ project_id, action_id, done }) =>
    service.completeAction(project_id as string, action_id as string, done as boolean)));

  server.registerTool("executar_complete_checkpoint", {
    title: "Validar checkpoint EXECUTA",
    description: "Confirma ou reabre um checkpoint. A confirmação é bloqueada enquanto suas três tarefas estiverem pendentes.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      checkpoint_id: z.string().regex(/^T\d{2}$/),
      done: z.boolean().optional().default(true),
      force: z.boolean().optional().default(false),
    },
    outputSchema,
    annotations: WRITE,
  }, guard(async ({ project_id, checkpoint_id, done, force }) =>
    service.completeCheckpoint(project_id as string, checkpoint_id as string, done as boolean, force as boolean)));

  server.registerTool("executar_export_package", {
    title: "Exportar pacote EXECUTA",
    description: "Exporta o pacote portável {project, progress} usado pelo aplicativo.",
    inputSchema: { project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/) },
    outputSchema,
    annotations: READ,
  }, guard(async ({ project_id }) => service.exportPackage(project_id as string)));

  server.registerTool("executar_reset_progress", {
    title: "Limpar progresso EXECUTA",
    description: "Remove todo o progresso do projeto. Exige confirm=true.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      confirm: z.boolean(),
    },
    outputSchema,
    annotations: DESTRUCTIVE,
  }, guard(async ({ project_id, confirm }) => {
    if (confirm !== true) throw new Error("CONFIRMATION_REQUIRED");
    return service.resetProgress(project_id as string);
  }));

  server.registerTool("executar_delete_project", {
    title: "Excluir projeto EXECUTA",
    description: "Exclui definitivamente projeto e progresso. Exige confirm=true.",
    inputSchema: {
      project_id: z.string().regex(/^PRJ-[A-Za-z0-9-]+$/),
      confirm: z.boolean(),
    },
    outputSchema,
    annotations: DESTRUCTIVE,
  }, guard(async ({ project_id, confirm }) => {
    if (confirm !== true) throw new Error("CONFIRMATION_REQUIRED");
    return service.deleteProject(project_id as string);
  }));
}
