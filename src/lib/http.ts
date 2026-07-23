import { VaultProblem } from "./vault.js";

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    ...SECURITY_HEADERS,
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Response(body, {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });
}

/**
 * Netlify's Request.url was always an absolute URL; Vercel's Node.js
 * function runtime hands handlers a Request whose .url is relative
 * (e.g. "/api/vault/files"), which makes plain `new URL(request.url)`
 * throw ERR_INVALID_URL. Every route handler that needs pathname/query
 * should read it through this instead — the placeholder base is never
 * exposed to a caller, only .pathname/.searchParams are ever read.
 */
export function absoluteUrl(request: Request): URL {
  return new URL(request.url, "http://localhost");
}

/**
 * Same problem, but for handing the Request itself to a third-party
 * library (the MCP SDK's transport) that does its own unguarded
 * `new URL(req.url)` internally — reconstructs a Request whose .url is
 * guaranteed absolute, preserving method/headers/body.
 */
export function withAbsoluteRequestUrl(request: Request): Request {
  if (/^https?:\/\//i.test(request.url)) return request;
  const url = absoluteUrl(request).toString();
  const init: RequestInit & { duplex?: "half" } = { method: request.method, headers: request.headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(url, init);
}

/**
 * OAuth (RFC 8414/7591) and MCP endpoints are reached cross-origin from the
 * MCP client (e.g. claude.ai), which the MCP authorization spec expects
 * servers to support via CORS. First-party endpoints (admin/vault/pm) stay
 * same-origin only and must NOT use these — they're deliberately excluded.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function corsPreflight(allowed: string[]): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Allow-Methods": [...allowed, "OPTIONS"].join(", ") } });
}

/**
 * VaultProblem carries a deliberately client-safe message — every throw
 * site in this codebase writes it for the caller to read, and callers that
 * expect it (vault-files.mts) already catch it before reaching here.
 * Anything else (parser internals, blob-store errors, a missing env var)
 * is NOT written for a client audience, so its message/stack goes to
 * server logs only; the response gets a fixed generic message instead
 * (baseline §11.6 — do not repeat the "message=raw Error.message" mistake).
 *
 * The response shape ({error: "server_error", message}) is unchanged from
 * before this fix — oauth-token.mts/oauth-register.mts rely on the flat
 * RFC 6749 `error` string, and vault-status/export/import use the same
 * flat shape for their own expected errors. Only the leak is closed.
 */
export function safeError(error: unknown): Response {
  if (error instanceof VaultProblem) {
    return json({ error: error.code, message: error.message }, { status: 400 });
  }
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  return json({ error: "server_error", message: "An unexpected error occurred." }, { status: 500 });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}
