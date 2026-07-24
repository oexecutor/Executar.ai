import path from "node:path";
import { requireAdminHtml } from "../src/lib/admin-guard.js";
import { baseUrl } from "../src/lib/env.js";
import { absoluteUrl } from "../src/lib/http.js";
import { vaultStore } from "../src/lib/stores.js";
import { BlobVaultService, VaultProblem } from "../src/lib/vault.js";
import { buildWorkflowDashboardUrl, isGeneratedWorkflowDashboard } from "../src/lib/workflow-dashboard.js";
import { getAuthenticatedRequest } from "../src/lib/request-auth.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

const DASHBOARD_ROOT = "DESK-OS/Dashboards/Workflows/";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function headers(contentType = "text/html; charset=utf-8"): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "public, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
}

function errorPage(title: string, message: string): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;padding:32px}.wrap{max-width:720px;margin:auto;border:1px solid #263041;background:#151b23;padding:24px;border-radius:12px}h1{font-size:24px}p{color:#8b98a5}a{color:#5fa8ff}</style><body><div class="wrap"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">Voltar ao dashboard do vault</a></p></div></body></html>`;
}

function listPage(items: Array<{ path: string; modifiedAt: string }>): string {
  const rows = items.length
    ? items.map((item) => `<li><a href="${escapeHtml(buildWorkflowDashboardUrl(baseUrl(), item.path))}">${escapeHtml(path.posix.basename(path.posix.dirname(item.path)))}</a><small>${escapeHtml(new Date(item.modifiedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</small></li>`).join("")
    : "<li>Nenhum dashboard dinâmico foi gerado.</li>";
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboards DESK-OS</title><style>body{margin:0;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;padding:32px}.wrap{max-width:860px;margin:auto}.eyebrow{font:12px ui-monospace,monospace;color:#5fa8ff;letter-spacing:.12em;text-transform:uppercase}h1{font-size:28px}ul{list-style:none;padding:0;display:grid;gap:10px}li{border:1px solid #263041;background:#151b23;border-radius:10px;padding:16px;display:flex;justify-content:space-between;gap:16px}a{color:#e6edf3;font-weight:650;text-decoration:none}small{color:#8b98a5}</style><body><div class="wrap"><div class="eyebrow">DESK-OS · Vault</div><h1>Dashboards dinâmicos</h1><ul>${rows}</ul></div></body></html>`;
}

async function workflowDashboardHandler(request: Request): Promise<Response> {
  const denied = await requireAdminHtml(request);
  if (denied) return denied;
  const auth = await getAuthenticatedRequest(request);
  if (!auth) return new Response(errorPage("Sessão expirada", "Entre novamente no EXECUTA.AI."), { status: 401, headers: headers() });
  const vault = new BlobVaultService(vaultStore({ workspaceId: auth.workspaceId, accessToken: auth.accessToken }));
  const url = absoluteUrl(request);
  const requestedPath = url.searchParams.get("path")?.trim();

  try {
    if (!requestedPath) {
      const records = (await vault.allRecords())
        .filter((record) => record.path.startsWith(DASHBOARD_ROOT) && record.path.endsWith("/STATUS_DASHBOARD.html"))
        .map((record) => ({ path: record.path, modifiedAt: record.modifiedAt }));
      return new Response(listPage(records), { headers: headers() });
    }
    if (!requestedPath.startsWith(DASHBOARD_ROOT) || !requestedPath.endsWith("/STATUS_DASHBOARD.html")) {
      return new Response(errorPage("Dashboard não permitido", "Somente dashboards gerados pelo workflow podem ser renderizados."), { status: 403, headers: headers() });
    }
    const { bytes } = await vault.getFileBytes(requestedPath);
    const content = Buffer.from(bytes).toString("utf8");
    if (!isGeneratedWorkflowDashboard(content)) {
      return new Response(errorPage("Dashboard inválido", "O arquivo não contém a assinatura de geração segura do DESK-OS."), { status: 415, headers: headers() });
    }
    return new Response(content, { headers: headers() });
  } catch (error) {
    if (error instanceof VaultProblem) {
      return new Response(errorPage("Dashboard indisponível", `${error.message} ${error.suggestion}`), { status: error.code === "NOT_FOUND" ? 404 : 400, headers: headers() });
    }
    console.error(error instanceof Error ? error.message : String(error));
    return new Response(errorPage("Erro interno", "O dashboard não pôde ser carregado."), { status: 500, headers: headers() });
  }
}

export { workflowDashboardHandler };
export default createVercelNodeHandler(workflowDashboardHandler);
