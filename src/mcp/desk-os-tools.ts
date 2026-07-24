import crypto from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DeskOsService } from "../application/desk-os-service.js";
import type { ActorContext } from "../application/context.js";
import { DomainError } from "../domain/errors.js";
import { EPISTEMIC_TYPES, PRIORITIES, TASK_STATUSES } from "../domain/entities.js";
import { VaultProblem } from "../lib/vault.js";

/**
 * The desk_os_* catalog from contracts/mcp-tools.yaml. Registered ALONGSIDE
 * the 19 existing obsidian_ and desk_ tools (baseline §3: additive, never a
 * rename) and calling only application services (AGENTS.md rule 6).
 */

const idempotencyKey = z.string().min(1).describe("Client-generated key; replays return the original result.");
const projectId = z.string().regex(/^prj_[A-Za-z0-9_-]+$/);
const sprintId = z.string().regex(/^spr_[A-Za-z0-9_-]+$/);
const taskId = z.string().regex(/^tsk_[A-Za-z0-9_-]+$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const resultOutput = { result: z.object({}).passthrough() };

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const IDEMPOTENT_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

interface ToolEnvelope {
  ok: boolean;
  data: unknown;
  warnings: string[];
  request_id: string;
  audit_id: string | null;
}

function envelope(data: unknown, requestId: string, auditId: string | null = null, warnings: string[] = []): ToolEnvelope {
  return { ok: true, data, warnings, request_id: requestId, audit_id: auditId };
}

function failure(error: unknown, requestId: string) {
  const payload =
    error instanceof DomainError || error instanceof VaultProblem
      ? { code: error.code, message: error.message, suggestion: error.suggestion }
      : { code: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error), suggestion: "Inspect server logs and retry." };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: payload, request_id: requestId }, null, 2) }],
  };
}

export function registerDeskOsTools(
  server: McpServer,
  service: DeskOsService,
  actorId: string,
  workspaceId?: string,
): void {
  const guard = <T extends Record<string, unknown>>(
    summary: string,
    action: (input: T, context: ActorContext) => Promise<ToolEnvelope>,
  ) => {
    return async (input: T) => {
      const requestId = `req_${crypto.randomUUID()}`;
      const context: ActorContext = { actorType: "MCP_CLIENT", actorId, workspaceId, requestId };
      try {
        const result = await action(input, context);
        return {
          content: [{ type: "text" as const, text: `${summary}\n\n${JSON.stringify(result, null, 2)}` }],
          structuredContent: { result: result as unknown as Record<string, unknown> },
        };
      } catch (error) {
        return failure(error, requestId);
      }
    };
  };

  /* -------------------------------- reads -------------------------------- */

  server.registerTool("desk_os_get_system_status", {
    title: "DESK-OS system status",
    description: "Return schema version, storage adapter, record counts and capacity limits of the PM state.",
    inputSchema: {}, outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("System status.", async (_input, context) => envelope(await service.getSystemStatus(), context.requestId)));

  server.registerTool("desk_os_search_context", {
    title: "Search DESK-OS context",
    description: "Search projects, tasks, evidence records and vault notes for a term.",
    inputSchema: {
      query: z.string().min(1),
      project_id: projectId.nullable().optional(),
      types: z.array(z.enum(["project", "task", "evidence", "note"])).optional(),
      limit: z.number().int().min(1).max(50).optional().default(10),
    }, outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Context search.", async (input, context) =>
    envelope(
      await service.searchContext({
        query: input.query as string,
        projectId: (input.project_id as string | null | undefined) ?? null,
        types: input.types as string[] | undefined,
        limit: input.limit as number | undefined,
      }),
      context.requestId,
    )));

  server.registerTool("desk_os_list_projects", {
    title: "List DESK-OS projects",
    description: "List project summaries from the index (cheap read), with status and text filters.",
    inputSchema: {
      status: z.array(z.string()).optional(),
      query: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(100).optional().default(25),
    }, outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Projects listed.", async (input, context) =>
    envelope(
      await service.listProjects({
        status: input.status as string[] | undefined,
        query: (input.query as string | null | undefined) ?? null,
        limit: input.limit as number | undefined,
      }),
      context.requestId,
    )));

  server.registerTool("desk_os_get_project", {
    title: "Get DESK-OS project",
    description: "Return a project with its sprints, tasks and evidence.",
    inputSchema: {
      project_id: projectId,
      include: z.array(z.enum(["sprints", "tasks", "evidence"])).optional().default(["sprints", "tasks", "evidence"]),
    }, outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Project detail.", async (input, context) =>
    envelope(await service.getProject(input.project_id as string, input.include as string[]), context.requestId)));

  server.registerTool("desk_os_get_current_sprint", {
    title: "Get current sprint",
    description: "Return the active (or next planned) sprint, optionally scoped to a project.",
    inputSchema: { project_id: projectId.nullable().optional() }, outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Current sprint.", async (input, context) =>
    envelope(await service.getCurrentSprint((input.project_id as string | null | undefined) ?? null), context.requestId)));

  server.registerTool("desk_os_get_board", {
    title: "Get sprint board",
    description: "Return the sprint Kanban board grouped by the contract's columns.",
    inputSchema: { sprint_id: sprintId, include_completed: z.boolean().optional().default(true) },
    outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Sprint board.", async (input, context) =>
    envelope(await service.getBoard(input.sprint_id as string, input.include_completed as boolean), context.requestId)));

  server.registerTool("desk_os_get_today", {
    title: "Get Today view",
    description: "Return the dominant delivery, next action, in-progress/ready/blocked tasks for a date.",
    inputSchema: { date: isoDate.nullable().optional(), project_id: projectId.nullable().optional() },
    outputSchema: resultOutput, annotations: READ_ONLY,
  }, guard("Today view.", async (input, context) =>
    envelope(
      await service.getToday({
        date: (input.date as string | null | undefined) ?? null,
        projectId: (input.project_id as string | null | undefined) ?? null,
      }),
      context.requestId,
    )));

  /* ------------------------------- writes -------------------------------- */

  server.registerTool("desk_os_create_project", {
    title: "Create DESK-OS project",
    description: "Create a project (PLANNED) with objective and definition of done. Idempotent via idempotency_key.",
    inputSchema: {
      idempotency_key: idempotencyKey,
      title: z.string().min(1).max(200),
      objective: z.string().min(1),
      definition_of_done: z.array(z.string().min(1)).min(1),
      context: z.string().optional().default(""),
      priority: z.enum(PRIORITIES).optional().default("MEDIUM"),
      note_refs: z.array(z.string()).optional().default([]),
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Project created.", async (input, context) => {
    const result = await service.createProject(
      {
        title: input.title,
        objective: input.objective,
        definitionOfDone: input.definition_of_done,
        context: input.context,
        priority: input.priority,
        noteRefs: input.note_refs,
      },
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_update_project", {
    title: "Update DESK-OS project",
    description: "Patch project fields (incl. status transitions) with optimistic concurrency.",
    inputSchema: {
      project_id: projectId,
      expected_version: z.number().int().min(1),
      patch: z.record(z.unknown()),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Project updated.", async (input, context) => {
    const result = await service.updateProject(
      input.project_id as string,
      input.patch,
      input.expected_version as number,
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_create_sprint", {
    title: "Create sprint",
    description: "Create a PLANNED sprint for a project.",
    inputSchema: {
      project_id: projectId,
      title: z.string().min(1).max(160),
      goal: z.string().min(1),
      start_date: isoDate,
      end_date: isoDate,
      capacity_hours: z.number().min(0).nullable().optional().default(null),
      wip_limit: z.number().int().min(1).optional().default(1),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Sprint created.", async (input, context) => {
    const result = await service.createSprint(
      {
        projectId: input.project_id,
        title: input.title,
        goal: input.goal,
        startDate: input.start_date,
        endDate: input.end_date,
        capacityHours: input.capacity_hours,
        wipLimit: input.wip_limit,
      },
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_update_sprint", {
    title: "Update sprint",
    description: "Patch sprint fields (incl. status transitions, one active workflow enforced).",
    inputSchema: {
      sprint_id: sprintId,
      expected_version: z.number().int().min(1),
      patch: z.record(z.unknown()),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Sprint updated.", async (input, context) => {
    const result = await service.updateSprint(
      input.sprint_id as string,
      input.patch,
      input.expected_version as number,
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_create_task", {
    title: "Create task",
    description: "Create a BACKLOG task with an observable outcome and at most 3 steps.",
    inputSchema: {
      project_id: projectId,
      sprint_id: sprintId.nullable().optional().default(null),
      title: z.string().min(1).max(200),
      outcome: z.string().min(1),
      acceptance_criteria: z.array(z.string()).optional().default([]),
      priority: z.enum(PRIORITIES).optional().default("MEDIUM"),
      steps: z.array(z.object({ title: z.string().min(1).max(160), status: z.enum(["TODO", "DOING", "DONE"]).optional().default("TODO") })).max(3).optional().default([]),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Task created.", async (input, context) => {
    const result = await service.createTask(
      {
        projectId: input.project_id,
        sprintId: input.sprint_id,
        title: input.title,
        outcome: input.outcome,
        acceptanceCriteria: input.acceptance_criteria,
        priority: input.priority,
        steps: input.steps,
      },
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_update_task", {
    title: "Update task",
    description: "Patch task fields (steps, dependencies, dominant date) with optimistic concurrency.",
    inputSchema: {
      task_id: taskId,
      expected_version: z.number().int().min(1),
      patch: z.record(z.unknown()),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Task updated.", async (input, context) => {
    const result = await service.updateTask(
      input.task_id as string,
      input.patch,
      input.expected_version as number,
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_move_task", {
    title: "Move task on the board",
    description: "Move a task to a Kanban column/position. Transition rules, WIP limit, blocked reason and completion evidence are enforced.",
    inputSchema: {
      task_id: taskId,
      target_status: z.enum(TASK_STATUSES),
      target_position: z.number(),
      expected_version: z.number().int().min(1),
      idempotency_key: idempotencyKey,
      blocked_reason: z.string().optional(),
      completion_evidence: z.array(z.string()).optional(),
      override_reason: z.string().optional(),
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Task moved.", async (input, context) => {
    const result = await service.moveTask(
      {
        taskId: input.task_id as string,
        targetStatus: input.target_status as string,
        targetPosition: input.target_position as number,
        expectedVersion: input.expected_version as number,
        idempotencyKey: input.idempotency_key as string,
        blockedReason: input.blocked_reason as string | undefined,
        completionEvidence: input.completion_evidence as string[] | undefined,
        overrideReason: input.override_reason as string | undefined,
      },
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_add_evidence", {
    title: "Add epistemic record",
    description: "Append a FACT/EVIDENCE/INFERENCE/HYPOTHESIS/COUNTEREVIDENCE/GAP/DECISION record to a project.",
    inputSchema: {
      project_id: projectId,
      task_id: taskId.nullable().optional().default(null),
      type: z.enum(EPISTEMIC_TYPES),
      statement: z.string().min(1),
      source_refs: z.array(z.string()),
      confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
      implications: z.string().optional().default(""),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Evidence recorded.", async (input, context) => {
    const result = await service.addEvidence(
      {
        projectId: input.project_id,
        taskId: input.task_id,
        type: input.type,
        statement: input.statement,
        sourceRefs: input.source_refs,
        confidence: input.confidence,
        implications: input.implications,
      },
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.replayed ? ["idempotency replay"] : []);
  }));

  server.registerTool("desk_os_prepare_decomposition", {
    title: "Prepare decomposition proposal",
    description: "Validate and persist a decomposition proposal. Mutates ONLY the proposal record, never projects/sprints/tasks.",
    inputSchema: {
      project_id: projectId,
      proposal: z.record(z.unknown()),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Proposal prepared.", async (input, context) => {
    const result = await service.prepareDecomposition(
      input.project_id as string,
      input.proposal,
      input.idempotency_key as string,
      context,
    );
    return envelope(result.record, context.requestId, result.auditId, result.warnings);
  }));

  server.registerTool("desk_os_apply_decomposition", {
    title: "Apply decomposition proposal",
    description: "Apply an approved proposal: creates sprints/tasks/evidence after a backup. Requires approved_by_user=true.",
    inputSchema: {
      proposal_id: z.string().regex(/^prop_[A-Za-z0-9_-]+$/),
      expected_version: z.number().int().min(1),
      approved_by_user: z.boolean(),
      idempotency_key: idempotencyKey,
      approval_note: z.string().nullable().optional().default(null),
    }, outputSchema: resultOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, guard("Proposal applied.", async (input, context) => {
    const result = await service.applyDecomposition(
      {
        proposalId: input.proposal_id as string,
        expectedVersion: input.expected_version as number,
        approvedByUser: input.approved_by_user as boolean,
        idempotencyKey: input.idempotency_key as string,
        approvalNote: input.approval_note as string | null,
      },
      context,
    );
    return envelope(result, context.requestId, result.auditId);
  }));

  server.registerTool("desk_os_close_sprint", {
    title: "Close sprint with review",
    description: "Complete a sprint, storing the review outcome and recording the closing DECISION as evidence.",
    inputSchema: {
      sprint_id: sprintId,
      expected_version: z.number().int().min(1),
      review: z.object({ outcome: z.string().min(1), evidence_refs: z.array(z.string()), decision: z.string().min(1) }),
      idempotency_key: idempotencyKey,
    }, outputSchema: resultOutput, annotations: IDEMPOTENT_WRITE,
  }, guard("Sprint closed.", async (input, context) => {
    const result = await service.closeSprint(
      {
        sprintId: input.sprint_id as string,
        expectedVersion: input.expected_version as number,
        review: input.review,
        idempotencyKey: input.idempotency_key as string,
      },
      context,
    );
    return envelope({ sprint: result.record, decisionId: result.decisionId }, context.requestId, result.auditId);
  }));
}
