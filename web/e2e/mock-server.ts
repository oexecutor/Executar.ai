import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_ROOT = fileURLToPath(new URL("../../public/app", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  const relative = pathname === "/app" || pathname === "/app/" ? "/index.html" : pathname.replace(/^\/app/, "");
  const resolved = normalize(join(STATIC_ROOT, relative));
  if (!resolved.startsWith(STATIC_ROOT)) return false;
  const filePath = existsSync(resolved) && statSync(resolved).isFile() ? resolved : join(STATIC_ROOT, "index.html");
  if (!existsSync(filePath)) return false;
  res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
  return true;
}

/**
 * A minimal stand-in for the real Vercel Functions API, implementing just
 * enough of /api/admin/* and /api/pm/* to drive the real React app through
 * a full login -> Today -> create project -> board -> create/move/edit
 * task -> logout cycle in a real browser (Playwright), without needing
 * `vercel dev` (which this sandbox's proxy cannot run — see the smoke
 * test commit for the reproduction). This exercises actual UI behavior,
 * not a mocked component tree.
 */

const ADMIN_PASSWORD = "e2e-test-password";
const SESSION_COOKIE = "e2e_session=1";

interface Project {
  id: string;
  title: string;
  status: string;
  priority: string;
  version: number;
  updatedAt: string;
}
interface Sprint {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  wipLimit: number;
  version: number;
}
interface Task {
  id: string;
  projectId: string;
  sprintId: string;
  title: string;
  outcome: string;
  status: string;
  priority: string;
  position: number;
  dominantDate: string | null;
  dueAt: string | null;
  blockedReason: string | null;
  stepsTotal: number;
  stepsDone: number;
  version: number;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

const state: { projects: Project[]; sprints: Sprint[]; tasks: Task[] } = {
  projects: [],
  sprints: [],
  tasks: [],
};

export function resetState(): void {
  state.projects = [];
  state.sprints = [];
  state.tasks = [];
  idCounter = 0;
}

function send(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...extraHeaders });
  res.end(payload);
}

function ok<T>(res: ServerResponse, data: T, status = 200) {
  send(res, status, { ok: true, data, warnings: [], request_id: "req_e2e", audit_id: null });
}

function fail(res: ServerResponse, status: number, code: string, message: string) {
  send(res, status, { ok: false, error: { code, message }, request_id: "req_e2e" });
}

function isAuthenticated(req: IncomingMessage): boolean {
  return (req.headers.cookie ?? "").includes(SESSION_COOKIE);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function currentSprint(): Sprint | null {
  return state.sprints.find((sprint) => sprint.status === "ACTIVE" || sprint.status === "PLANNED") ?? null;
}

function boardFor(sprintId: string) {
  const sprint = state.sprints.find((entry) => entry.id === sprintId) ?? null;
  const columns = ["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE"].map((status) => ({
    status,
    tasks: state.tasks.filter((task) => task.sprintId === sprintId && task.status === status),
  }));
  return { sprint, columns };
}

export function startMockServer(port: number) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    // Static assets (the built React app) are never auth-gated, same as
    // real Vercel static hosting — only /api/* functions are.
    if (method === "GET" && !path.startsWith("/api/")) {
      if (serveStatic(req, res, path)) return;
    }

    if (method === "POST" && path === "/api/admin/login") {
      const body = await readJsonBody(req);
      if (body.password !== ADMIN_PASSWORD) return fail(res, 401, "INVALID_CREDENTIALS", "Senha inválida.");
      return send(res, 200, { authenticated: true }, { "Set-Cookie": `${SESSION_COOKIE}; Path=/; HttpOnly` });
    }
    if (method === "POST" && path === "/api/admin/logout") {
      return send(res, 200, { authenticated: false }, { "Set-Cookie": `${SESSION_COOKIE.split("=")[0]}=; Max-Age=0` });
    }

    if (!isAuthenticated(req)) return fail(res, 401, "UNAUTHORIZED", "Autenticação necessária.");

    if (method === "GET" && path === "/api/pm/status") return ok(res, { storageAdapter: "vault" });

    if (method === "GET" && path === "/api/pm/today") {
      const sprint = currentSprint();
      const tasks = sprint ? state.tasks.filter((task) => task.sprintId === sprint.id) : [];
      return ok(res, {
        date: "2026-07-21",
        sprint,
        dominantDelivery: null,
        nextAction: tasks.find((task) => task.status === "READY") ?? null,
        inProgress: tasks.filter((task) => task.status === "IN_PROGRESS"),
        ready: tasks.filter((task) => task.status === "READY"),
        blocked: tasks.filter((task) => task.status === "BLOCKED"),
        warnings: [],
      });
    }

    if (method === "POST" && path === "/api/pm/projects") {
      const body = await readJsonBody(req);
      const project: Project = {
        id: nextId("prj"),
        title: String(body.title ?? ""),
        status: "PLANNED",
        priority: "MEDIUM",
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      state.projects.push(project);
      return ok(res, project, 201);
    }

    if (method === "POST" && path === "/api/pm/sprints") {
      const body = await readJsonBody(req);
      const sprint: Sprint = {
        id: nextId("spr"),
        projectId: String(body.projectId ?? ""),
        title: String(body.title ?? ""),
        goal: String(body.goal ?? ""),
        status: "ACTIVE",
        startDate: String(body.startDate ?? ""),
        endDate: String(body.endDate ?? ""),
        wipLimit: 1,
        version: 1,
      };
      state.sprints.push(sprint);
      return ok(res, sprint, 201);
    }

    if (method === "GET" && path === "/api/pm/sprints/current") {
      return ok(res, currentSprint());
    }

    if (method === "GET" && /^\/api\/pm\/sprints\/[^/]+\/board$/.test(path)) {
      const sprintId = path.split("/")[4];
      return ok(res, boardFor(sprintId));
    }

    if (method === "POST" && path === "/api/pm/tasks") {
      const body = await readJsonBody(req);
      const steps = Array.isArray(body.steps) ? (body.steps as Array<{ title: string }>) : [];
      const task: Task = {
        id: nextId("tsk"),
        projectId: String(body.projectId ?? ""),
        sprintId: String(body.sprintId ?? ""),
        title: String(body.title ?? ""),
        outcome: String(body.outcome ?? ""),
        status: "BACKLOG",
        priority: String(body.priority ?? "MEDIUM"),
        position: state.tasks.length + 1,
        dominantDate: null,
        dueAt: null,
        blockedReason: null,
        stepsTotal: steps.length,
        stepsDone: 0,
        version: 1,
      };
      state.tasks.push(task);
      return ok(res, task, 201);
    }

    const taskMatch = path.match(/^\/api\/pm\/tasks\/([^/]+)$/);
    if (method === "PATCH" && taskMatch) {
      const task = state.tasks.find((entry) => entry.id === taskMatch[1]);
      if (!task) return fail(res, 404, "NOT_FOUND", "Task not found.");
      const body = await readJsonBody(req);
      const patch = (body.patch as Record<string, unknown>) ?? {};
      if (typeof patch.title === "string") task.title = patch.title;
      if (typeof patch.priority === "string") task.priority = patch.priority;
      task.version += 1;
      return ok(res, task);
    }

    const moveMatch = path.match(/^\/api\/pm\/tasks\/([^/]+)\/move$/);
    if (method === "POST" && moveMatch) {
      const task = state.tasks.find((entry) => entry.id === moveMatch[1]);
      if (!task) return fail(res, 404, "NOT_FOUND", "Task not found.");
      const body = await readJsonBody(req);
      task.status = String(body.target_status ?? task.status);
      task.blockedReason = typeof body.blocked_reason === "string" ? body.blocked_reason : null;
      task.version += 1;
      return ok(res, task);
    }

    fail(res, 404, "NOT_FOUND", `No mock route for ${method} ${path}`);
  });

  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      resolve({
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}
