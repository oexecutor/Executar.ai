export class VaultProblem extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly suggestion?: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "VaultProblem";
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { ...init, headers });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json(
    {
      error: {
        code: "method_not_allowed",
        message: `Method not allowed. Use: ${allowed.join(", ")}.`,
      },
    },
    { status: 405, headers: { Allow: allowed.join(", ") } },
  );
}

/**
 * Error responses never leak internals: only VaultProblem instances carry
 * their message to the client; everything else becomes a generic 500 and
 * is logged server-side.
 */
export function safeError(err: unknown): Response {
  if (err instanceof VaultProblem) {
    return json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.suggestion ? { suggestion: err.suggestion } : {}),
        },
      },
      { status: err.status },
    );
  }
  console.error("Unexpected error:", err);
  return json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
