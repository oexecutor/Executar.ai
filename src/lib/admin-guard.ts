import { getAuthenticatedRequest } from "./request-auth.js";

/**
 * Phase 4 authentication boundary. Login was removed at the operator's
 * explicit request: every caller without a real session uses the shared
 * public workspace instead of being blocked by a sign-in step.
 */
export async function requireAdminJson(request: Request): Promise<Response | null> {
  if (await getAuthenticatedRequest(request)) return null;
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Entre no EXECUTA.AI e selecione um workspace.",
      },
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        Vary: "Authorization, Cookie, X-Workspace-Id",
      },
    },
  );
}

export async function requireAdminHtml(request: Request): Promise<Response | null> {
  if (await getAuthenticatedRequest(request)) return null;
  // Redirect to /app (the workspace) instead of a login page.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/app`,
      "Cache-Control": "private, no-store",
    },
  });
}
