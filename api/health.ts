import { json } from "../src/lib/http.js";

export default async (): Promise<Response> => json({ service: "desk-os-obsidian-mcp", status: "ok", transport: "streamable-http", authentication: "oauth-2.1-pkce" });
