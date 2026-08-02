import crypto from "node:crypto";
import { absoluteUrl, corsPreflight, json, withCors } from "../lib/http.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QR_TOKEN = /^qr_[A-Za-z0-9_-]{24,96}$/;
const EVIDENCE_KINDS = new Set(["NOTE", "PHOTO", "FILE", "LINK", "QR_RECYCLE"]);

interface SupabaseErrorBody {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function configuration(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase público não configurado.");
  return { url: url.replace(/\/$/, ""), key };
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization")?.trim() ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function mobileJson(data: unknown, status = 200): Response {
  return withCors(json(data, { status, headers: { "Cache-Control": "private, no-store" } }));
}

function invalid(message: string): Response {
  return mobileJson({ error: "invalid_request", message }, 422);
}

async function supabase<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; response: Response }> {
  const { url, key } = configuration();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");

  const response = await fetch(`${url}${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => null) as T | SupabaseErrorBody | null;
  if (!response.ok) {
    const problem = (body ?? {}) as SupabaseErrorBody;
    const error = new Error(problem.message || "Operação recusada pelo Supabase.");
    Object.assign(error, { status: response.status, code: problem.code });
    throw error;
  }
  return { data: body as T, response };
}

function projectSummary(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function qrResolution(row: Record<string, unknown>) {
  return {
    token: row.token,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    taskId: row.task_id ?? null,
    taskReference: row.task_reference ?? null,
    taskTitle: row.task_title ?? null,
    currentStatus: row.current_status ?? null,
    intent: row.intent,
    targetStatus: row.target_status ?? null,
    requiresConfirmation: row.requires_confirmation,
    status: row.status,
    expiresAt: row.expires_at ?? null,
  };
}

export async function mobileHandler(request: Request, pathOverride?: string): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight(["GET", "POST"]);

  const accessToken = bearer(request);
  if (!accessToken) return mobileJson({ error: "unauthorized", message: "Entre novamente para continuar." }, 401);

  const url = absoluteUrl(request);
  const path = pathOverride ?? (url.pathname.replace(/^\/api\/mobile/, "") || "/");

  try {
    if (request.method === "GET" && path === "/projects") {
      const { data } = await supabase<Record<string, unknown>[]>(
        accessToken,
        "/rest/v1/projects?select=id,workspace_id,code,name,description,status,updated_at&order=updated_at.desc",
      );
      return mobileJson({ projects: data.map(projectSummary) });
    }

    if (request.method === "POST" && path === "/projects") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const steps = Array.isArray(body.steps) ? body.steps.map(String) : [];
      if (typeof body.name !== "string" || body.name.trim().length < 3) return invalid("Informe o nome do projeto.");
      if (typeof body.firstTaskTitle !== "string" || !body.firstTaskTitle.trim()) return invalid("Informe a primeira tarefa.");
      if (steps.length !== 3 || steps.some((step) => !step.trim())) return invalid("A primeira tarefa deve conter exatamente três passos.");
      const { data } = await supabase<Record<string, unknown>>(
        accessToken,
        "/rest/v1/rpc/create_project_with_first_task",
        {
          method: "POST",
          body: JSON.stringify({
            p_name: body.name,
            p_description: typeof body.description === "string" ? body.description : "",
            p_first_task_title: body.firstTaskTitle,
            p_steps: steps,
          }),
        },
      );
      return mobileJson(data, 201);
    }

    const positionMatch = path.match(/^\/projects\/([^/]+)\/position$/);
    if (request.method === "GET" && positionMatch) {
      const projectId = positionMatch[1] ?? "";
      if (!UUID.test(projectId)) return invalid("Identificador de projeto inválido.");
      const { data } = await supabase<Record<string, unknown>>(
        accessToken,
        "/rest/v1/rpc/get_current_position",
        { method: "POST", body: JSON.stringify({ p_project_id: projectId }) },
      );
      return mobileJson(data);
    }

    const stepMatch = path.match(/^\/tasks\/([^/]+)\/steps\/([1-3])\/complete$/);
    if (request.method === "POST" && stepMatch) {
      const taskId = stepMatch[1] ?? "";
      const position = Number(stepMatch[2]);
      if (!UUID.test(taskId)) return invalid("Identificador de tarefa inválido.");
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
      if (idempotencyKey.length < 8 || idempotencyKey.length > 180) return invalid("Chave de idempotência inválida.");
      const { data } = await supabase<Record<string, unknown>>(
        accessToken,
        "/rest/v1/rpc/complete_task_step",
        { method: "POST", body: JSON.stringify({ p_task_id: taskId, p_position: position, p_idempotency_key: idempotencyKey }) },
      );
      return mobileJson(data);
    }

    const qrMatch = path.match(/^\/qr\/(qr_[A-Za-z0-9_-]+)$/);
    if (request.method === "GET" && qrMatch) {
      const token = qrMatch[1] ?? "";
      if (!QR_TOKEN.test(token)) return invalid("Token QR inválido.");
      const { data } = await supabase<Record<string, unknown>[]>(
        accessToken,
        "/rest/v1/rpc/resolve_qr_token",
        { method: "POST", body: JSON.stringify({ p_token: token }) },
      );
      if (!data[0]) return mobileJson({ error: "not_found", message: "QR não encontrado." }, 404);
      return mobileJson(qrResolution(data[0]));
    }

    if (request.method === "POST" && path === "/actions/confirm") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const token = typeof body.token === "string" ? body.token : "";
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
      if (!QR_TOKEN.test(token)) return invalid("Token QR inválido.");
      if (idempotencyKey.length < 8 || idempotencyKey.length > 180) return invalid("Chave de idempotência inválida.");
      const { data } = await supabase<Record<string, unknown>>(
        accessToken,
        "/rest/v1/rpc/confirm_qr_action",
        { method: "POST", body: JSON.stringify({ p_token: token, p_idempotency_key: idempotencyKey }) },
      );
      return mobileJson(data);
    }

    const evidenceMatch = path.match(/^\/tasks\/([^/]+)\/evidence$/);
    if (request.method === "POST" && evidenceMatch) {
      const taskId = evidenceMatch[1] ?? "";
      if (!UUID.test(taskId)) return invalid("Identificador de tarefa inválido.");
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const kind = typeof body.kind === "string" ? body.kind : "NOTE";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const content = typeof body.content === "string" ? body.content : null;
      const storagePath = typeof body.storagePath === "string" ? body.storagePath : null;
      if (!EVIDENCE_KINDS.has(kind)) return invalid("Tipo de evidência inválido.");
      if (!title) return invalid("Informe o título da evidência.");
      if (!content && !storagePath) return invalid("A evidência precisa de conteúdo ou arquivo.");

      const { data: tasks } = await supabase<Array<{ workspace_id: string; project_id: string }>>(
        accessToken,
        `/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=workspace_id,project_id&limit=1`,
      );
      const task = tasks[0];
      if (!task) return mobileJson({ error: "not_found", message: "Tarefa não encontrada." }, 404);
      const { data } = await supabase<Array<{ id: string }>>(
        accessToken,
        "/rest/v1/evidence?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            workspace_id: task.workspace_id,
            project_id: task.project_id,
            task_id: taskId,
            kind,
            title,
            content,
            storage_path: storagePath,
            mime_type: typeof body.mimeType === "string" ? body.mimeType : null,
          }),
        },
      );
      return mobileJson({ id: data[0]?.id ?? crypto.randomUUID() }, 201);
    }

    return mobileJson({ error: "not_found", message: `Rota móvel inexistente: ${request.method} ${path}.` }, 404);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 500;
    if (status === 401 || status === 403) return mobileJson({ error: "unauthorized", message: "Sessão inválida ou acesso não permitido." }, status);
    console.error("Mobile API failure", error instanceof Error ? error.message : String(error));
    return mobileJson({ error: "mobile_api_error", message: status < 500 && error instanceof Error ? error.message : "Não foi possível concluir a operação." }, status >= 400 && status < 600 ? status : 500);
  }
}
