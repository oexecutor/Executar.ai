import { clearAdminSessionCookie } from "../../src/lib/auth.mjs";
import { json, methodNotAllowed } from "../../src/lib/http.mjs";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  return json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearAdminSessionCookie() } },
  );
}
