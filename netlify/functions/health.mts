import { json, methodNotAllowed } from "../../src/lib/http.mjs";
import { deployContext } from "../../src/lib/env.mjs";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  return json({ status: "ok", service: "desk-os-mcp", context: deployContext() });
}
