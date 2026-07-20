import type { Config } from "@netlify/functions";
import { json } from "../../src/lib/http.mjs";

export default async (): Promise<Response> => json({ service: "desk-os-obsidian-mcp", status: "ok", transport: "streamable-http", authentication: "oauth-2.1-pkce" });

export const config: Config = { path: "/health" };
