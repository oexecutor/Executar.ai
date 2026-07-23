import { getAuthenticatedRequest } from "./request-auth.js";

/**
 * Phase 4 authentication boundary. JSON calls accept a verified Supabase
 * bearer bound to an active workspace membership, or the short-lived
 * HttpOnly app session issued by /api/auth/session. HTML routes redirect to
 * the public sign-in screen and never expose vault data anonymously.
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
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/entrar?return_to=${encodeURIComponent(returnTo)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
