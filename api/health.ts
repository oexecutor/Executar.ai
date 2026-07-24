import { json } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

async function healthHandler(): Promise<Response> {
  return json({ service: "desk-os-obsidian-mcp", status: "ok", transport: "streamable-http", authentication: "oauth-2.1-pkce" });
}

export { healthHandler };
export default createVercelNodeHandler(healthHandler);
