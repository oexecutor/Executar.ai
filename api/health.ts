import { json } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";
import { supabaseConfigured } from "../src/lib/supabase.js";
import { CONNECTION_STRING_VARS } from "../src/lib/kv-store.js";

function postgresConfigured(): boolean {
  return CONNECTION_STRING_VARS.some((name) => Boolean(process.env[name]));
}

function serviceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

async function healthHandler(): Promise<Response> {
  const supabaseClient = supabaseConfigured();
  const supabaseServer = serviceRoleConfigured();
  const supabaseState = supabaseClient && supabaseServer
    ? "configured"
    : supabaseClient || supabaseServer
      ? "partial"
      : "not_configured";

  return json({
    service: "desk-os-obsidian-mcp",
    status: "ok",
    transport: "streamable-http",
    authentication: "oauth-2.1-pkce",
    app_authentication: "supabase-auth+workspace-session",
    dependencies: {
      supabase: supabaseState,
      supabase_checks: {
        public_client: supabaseClient ? "configured" : "not_configured",
        service_role: supabaseServer ? "configured" : "not_configured",
      },
      postgres: postgresConfigured() ? "configured" : "not_configured",
    },
  });
}

export { healthHandler };
export default createVercelNodeHandler(healthHandler);
