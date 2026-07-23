import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_ROOT = fileURLToPath(new URL("../../public", import.meta.url));
const SESSION_COOKIE = "e2e_session=1";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const project = {
  meta: {
    id: "PRJ-E2E",
    name: "Lançamento EXECUTA.AI",
    description: "Validar a primeira versão operável com evidências.",
    owner: "Equipe EXECUTA",
    created_at: "2026-07-23T12:00:00.000Z",
    updated_at: "2026-07-23T12:00:00.000Z",
  },
  phases: [
    { id: "F1", title: "Clareza", areas: ["A1"] },
    { id: "F2", title: "Construção", areas: ["A2"] },
    { id: "F3", title: "Entrega", areas: ["A3"] },
  ],
  areas: [
    {
      id: "A1",
      title: "Direção e resultado",
      short_title: "Direção",
      items: [
        {
          id: "T01",
          type: "task",
          title: "Confirmar resultado de lançamento",
          evidence: "Critérios de aceite aprovados.",
          owner: "Produto",
          actions: [
            { id: "T01.1", title: "Revisar escopo", stop_condition: "Escopo aprovado." },
            { id: "T01.2", title: "Validar métricas", stop_condition: "Métricas registradas." },
            { id: "T01.3", title: "Aprovar gate", stop_condition: "Gate aprovado." },
          ],
        },
        {
          id: "C01",
          type: "checkpoint",
          title: "Direção aprovada",
          evidence: "Decisão registrada.",
        },
      ],
    },
    {
      id: "A2",
      title: "Produto e integração",
      short_title: "Produto",
      items: [
        {
          id: "T02",
          type: "task",
          title: "Integrar experiência e núcleo",
          evidence: "Fluxo completo funcionando.",
          owner: "Engenharia",
          actions: [
            { id: "T02.1", title: "Integrar API", stop_condition: "Contrato validado." },
            { id: "T02.2", title: "Validar interface", stop_condition: "Interface homologada." },
            { id: "T02.3", title: "Executar regressão", stop_condition: "Suíte verde." },
          ],
        },
        {
          id: "C02",
          type: "checkpoint",
          title: "Integração aprovada",
          evidence: "Regressão anexada.",
        },
      ],
    },
    {
      id: "A3",
      title: "Lançamento e aprendizado",
      short_title: "Lançamento",
      items: [
        {
          id: "T03",
          type: "task",
          title: "Preparar lançamento controlado",
          evidence: "Checklist e rollback aprovados.",
          owner: "Operações",
          actions: [
            { id: "T03.1", title: "Publicar preview", stop_condition: "Preview disponível." },
            { id: "T03.2", title: "Homologar jornada", stop_condition: "Jornada aprovada." },
            { id: "T03.3", title: "Autorizar produção", stop_condition: "Aceite humano registrado." },
          ],
        },
        {
          id: "C03",
          type: "checkpoint",
          title: "Lançamento autorizado",
          evidence: "Aprovação final registrada.",
        },
      ],
    },
  ],
  final_deliverables: [
    {
      id: "D1",
      title: "EXECUTA.AI operável",
      description: "Produto integrado e homologado.",
      linked_areas: ["A1", "A2", "A3"],
    },
  ],
};

let progress: Record<string, boolean> = {};

export function resetState(): void {
  progress = { "T01.1": true };
}

function summary() {
  const actionIds = project.areas.flatMap((area) =>
    area.items.flatMap((item) => item.type === "task" ? item.actions.map((action) => action.id) : []),
  );
  const done = actionIds.filter((id) => progress[id]).length;
  return {
    id: project.meta.id,
    name: project.meta.name,
    description: project.meta.description,
    owner: project.meta.owner,
    progressPct: Math.round((done / actionIds.length) * 100),
    actionsDone: done,
    actionsTotal: actionIds.length,
    updatedAt: project.meta.updated_at,
  };
}

function status() {
  const tasks = project.areas.flatMap((area) => area.items.filter((item) => item.type === "task"));
  const checkpoints = project.areas.flatMap((area) => area.items.filter((item) => item.type === "checkpoint"));
  const actions = tasks.flatMap((task) => task.actions);
  const actionsDone = actions.filter((action) => progress[action.id]).length;
  const tasksDone = tasks.filter((task) => task.actions.every((action) => progress[action.id])).length;
  const checkpointsDone = checkpoints.filter((item) => progress[item.id]).length;
  return {
    actions: {
      total: actions.length,
      done: actionsDone,
      pending: actions.length - actionsDone,
      pct: Math.round((actionsDone / actions.length) * 100),
    },
    items: {
      total: tasks.length + checkpoints.length,
      done: tasksDone + checkpointsDone,
      pending: tasks.length + checkpoints.length - tasksDone - checkpointsDone,
      checkpoints: { total: checkpoints.length, done: checkpointsDone },
      tasks: { total: tasks.length, done: tasksDone },
    },
    phases: project.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      total: 1,
      done: phase.id === "F1" && progress.C01 ? 1 : 0,
      pending: phase.id === "F1" && progress.C01 ? 0 : 1,
      pct: phase.id === "F1" && progress.C01 ? 100 : 0,
    })),
    deliverables: [{ ...project.final_deliverables[0], linkedAreas: ["A1", "A2", "A3"], pct: 11 }],
    current: {
      areaId: "A1",
      areaTitle: "Direção e resultado",
      itemId: "T01",
      itemTitle: "Confirmar resultado de lançamento",
      itemType: "task",
      action: { id: "T01.2", title: "Validar métricas", done: false },
    },
  };
}

function nextItems() {
  return project.areas
    .flatMap((area) => area.items.map((item) => ({ area, item })))
    .filter(({ item }) => item.type === "task" && !item.actions.every((action) => progress[action.id]))
    .map(({ area, item }) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      areaId: area.id,
      areaTitle: area.title,
      owner: item.owner,
      evidence: item.evidence,
      actions: item.actions.map((action) => ({ id: action.id, title: action.title, done: progress[action.id] === true })),
    }));
}

function send(res: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function ok(res: ServerResponse, data: unknown, statusCode = 200) {
  send(res, statusCode, { ok: true, data, warnings: [], request_id: "req_e2e" });
}

function fail(res: ServerResponse, statusCode: number, code: string, message: string) {
  send(res, statusCode, { ok: false, error: { code, message }, request_id: "req_e2e" });
}

function authenticated(req: IncomingMessage): boolean {
  return (req.headers.cookie ?? "").includes(SESSION_COOKIE);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function staticFile(pathname: string): string | null {
  const requestPath = pathname === "/" ? "/index.html"
    : pathname === "/app" || pathname === "/app/" ? "/app/index.html"
      : pathname === "/entrar" || pathname === "/entrar/" ? "/index.html"
        : pathname;
  const resolved = normalize(join(STATIC_ROOT, requestPath));
  if (resolved.startsWith(STATIC_ROOT) && existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  if (pathname.startsWith("/app/")) return join(STATIC_ROOT, "app/index.html");
  return null;
}

export function startMockServer(port: number) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && !path.startsWith("/api/")) {
      const filePath = staticFile(path);
      if (filePath && existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
        createReadStream(filePath).pipe(res);
        return;
      }
    }

    if (method === "GET" && path === "/api/auth/config") {
      return ok(res, { url: `http://localhost:${port}/supabase`, publishableKey: "e2e-publishable-key" });
    }
    if (method === "GET" && path === "/api/auth/me") {
      return authenticated(req)
        ? ok(res, {
            userId: "usr_e2e",
            email: "e2e@executa.ai",
            workspaceId: "wsp_e2e",
            workspaceName: "EXECUTA Preview",
            role: "OWNER",
          })
        : fail(res, 401, "UNAUTHORIZED", "Sessão não encontrada.");
    }
    if (method === "POST" && path === "/api/auth/logout") {
      return ok(res, { authenticated: false });
    }

    if (!authenticated(req)) return fail(res, 401, "UNAUTHORIZED", "Autenticação necessária.");

    if (method === "GET" && path === "/api/executar/projects") return ok(res, [summary()]);
    if (method === "GET" && path === `/api/executar/projects/${project.meta.id}`) {
      return ok(res, { project, progress, status: status() });
    }
    if (method === "GET" && path === `/api/executar/projects/${project.meta.id}/status`) return ok(res, status());
    if (method === "GET" && path === `/api/executar/projects/${project.meta.id}/next`) {
      return ok(res, { projectId: project.meta.id, next: nextItems() });
    }
    if (method === "GET" && path === "/api/vault/files") {
      return send(res, 200, {
        entries: [{
          path: "Projetos/PRJ-E2E/aceite.md",
          name: "aceite.md",
          extension: "md",
          isNote: true,
          isText: true,
          editable: true,
          sizeBytes: 420,
          modifiedAt: "2026-07-23T12:00:00.000Z",
          sha256: "e2e",
          viewUrl: "/view?path=Projetos%2FPRJ-E2E%2Faceite.md",
          downloadUrl: "/api/vault/files/Projetos%2FPRJ-E2E%2Faceite.md",
        }],
      });
    }

    const actionMatch = path.match(/^\/api\/executar\/projects\/PRJ-E2E\/actions\/([^/]+)$/);
    if (method === "POST" && actionMatch) {
      const body = await readBody(req);
      progress[actionMatch[1]] = body.done !== false;
      return ok(res, { actionId: actionMatch[1], done: progress[actionMatch[1]] });
    }

    const checkpointMatch = path.match(/^\/api\/executar\/projects\/PRJ-E2E\/checkpoints\/([^/]+)$/);
    if (method === "POST" && checkpointMatch) {
      const body = await readBody(req);
      progress[checkpointMatch[1]] = body.done !== false;
      return ok(res, { checkpointId: checkpointMatch[1], done: progress[checkpointMatch[1]] });
    }

    return fail(res, 404, "NOT_FOUND", `No mock route for ${method} ${path}`);
  });

  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      resolve({
        close: () => new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done())),
      });
    });
  });
}
