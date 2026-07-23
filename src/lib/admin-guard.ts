import { verifyAdminRequest } from "./auth.js";
import { absoluteUrl, escapeHtml, html, json } from "./http.js";

/**
 * Gate 0.5 enforcement helpers. JSON routes answer 401; human HTML routes
 * (/view, /dashboard) answer with a no-JS login form that posts to
 * /api/admin/login and returns to the original page.
 */
export async function requireAdminJson(request: Request): Promise<Response | null> {
  if (await verifyAdminRequest(request)) return null;
  return json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Autenticação necessária.",
        suggestion: "Entre com a senha do operador em POST /api/admin/login.",
      },
    },
    { status: 401 },
  );
}

export function loginPage(returnTo: string): Response {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return html(
    `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DESK-OS — Entrar</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #111; color: #eee; }
  form { display: grid; gap: 12px; padding: 32px; border: 1px solid #444; min-width: 280px; }
  input, button { font: inherit; padding: 10px 12px; }
  button { cursor: pointer; }
</style>
</head>
<body>
<form method="post" action="/api/admin/login">
  <h1 style="font-size:1.1rem;margin:0">DESK-OS</h1>
  <label for="password">Senha do operador</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
  <input type="hidden" name="return_to" value="${escapeHtml(safeReturnTo)}">
  <button type="submit">Entrar</button>
</form>
</body>
</html>`,
    { status: 401 },
  );
}

export async function requireAdminHtml(request: Request): Promise<Response | null> {
  if (await verifyAdminRequest(request)) return null;
  const url = absoluteUrl(request);
  return loginPage(url.pathname + url.search);
}
