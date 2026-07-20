import {
  adminSessionCookie,
  createAdminSessionToken,
  verifyAdminPassword,
} from "../../src/lib/auth.mjs";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const body = (await request.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyAdminPassword(password)) {
      return json(
        { error: { code: "invalid_credentials", message: "Invalid password." } },
        { status: 401 },
      );
    }
    return json(
      { authenticated: true, accessMode: "admin-session" },
      { headers: { "Set-Cookie": adminSessionCookie(createAdminSessionToken()) } },
    );
  } catch (err) {
    return safeError(err);
  }
}
