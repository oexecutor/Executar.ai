import { json } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";
import { supabaseConfigured } from "../src/lib/supabase.js";
import { CONNECTION_STRING_VARS } from "../src/lib/kv-store.js";

function postgresConfigured(): boolean {
  return CONNECTION_STRING_VARS.some((name) => Boolean(process.env[name]));
}

async function healthHandler(): Promise<Response> {
  return json({
    service: "desk-os-obsidian-mcp",
    status: "ok",
    transport: "streamable-http",
    authentication: "oauth-2.1-pkce",
    dependencies: {
      supabase: supabaseConfigured() ? "configured" : "not_configured",
      postgres: postgresConfigured() ? "configured" : "not_configured",
    },
  });
}

export { healthHandler };
export default createVercelNodeHandler(healthHandler);
