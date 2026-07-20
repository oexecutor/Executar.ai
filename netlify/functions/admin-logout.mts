import type { Config } from "@netlify/functions";
import { json, methodNotAllowed } from "../../src/lib/http.mjs";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  return json({ authenticated: true, accessMode: "open", passwordRequired: false });
};

export const config: Config = { path: "/api/admin/logout" };
