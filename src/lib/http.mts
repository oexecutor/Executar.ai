import { VaultProblem } from "./vault.mjs";

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...(init.headers ?? {}) },
  });
}

export function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SECURITY_HEADERS,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      ...(init.headers ?? {}),
    },
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });
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
