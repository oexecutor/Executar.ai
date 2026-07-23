import { adminAuthConfigured, adminCookie, clearAdminCookie, signAdminSession, verifyAdminPassword } from "../src/lib/auth.mjs";
import { json, methodNotAllowed } from "../src/lib/http.mjs";
import { loginPage } from "../src/lib/admin-guard.mjs";

/**
 * login + logout live in one function, dispatched by pathname, to stay
 * under Vercel's 12-function Hobby-plan cap — see api/oauth.ts and
 * api/vault.ts for the same pattern. Each section is otherwise unchanged
 * from its own former file.
 */

interface Credentials {
  password: string;
  returnTo: string | null;
  isForm: boolean;
}

async function readCredentials(request: Request): Promise<Credentials> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const returnTo = form.get("return_to");
    return {
      password: typeof form.get("password") === "string" ? String(form.get("password")) : "",
      returnTo: typeof returnTo === "string" ? returnTo : null,
      isForm: true,
    };
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  return { password: typeof body.password === "string" ? body.password : "", returnTo: null, isForm: false };
}

async function login(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!adminAuthConfigured()) {
    return json(
      {
        error: {
          code: "AUTH_NOT_CONFIGURED",
          message: "Autenticação do operador não está configurada.",
          suggestion: "Defina a variável de ambiente ADMIN_PASSWORD no Vercel.",
        },
      },
      { status: 503 },
    );
  }
  const credentials = await readCredentials(request);
  if (!verifyAdminPassword(credentials.password)) {
    if (credentials.isForm) return loginPage(credentials.returnTo ?? "/");
    return json({ error: { code: "INVALID_CREDENTIALS", message: "Senha inválida." } }, { status: 401 });
  }
  const cookie = adminCookie(await signAdminSession());
  if (credentials.isForm) {
    const returnTo =
      credentials.returnTo && credentials.returnTo.startsWith("/") && !credentials.returnTo.startsWith("//")
        ? credentials.returnTo
        : "/";
    return new Response(null, { status: 303, headers: { Location: returnTo, "Set-Cookie": cookie } });
  }
  return json({ authenticated: true, accessMode: "admin-session" }, { headers: { "Set-Cookie": cookie } });
}

async function logout(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  return json({ authenticated: false }, { headers: { "Set-Cookie": clearAdminCookie() } });
}

export default async (request: Request): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/admin/logout") return logout(request);
  return login(request);
};
