import crypto from "node:crypto";
import { strToU8, zipSync } from "fflate";

const base = process.env.SMOKE_BASE_URL;
if (!base) throw new Error("SMOKE_BASE_URL is required");

// Gate 0.5: /api/vault/*, /view and /dashboard now require an operator
// session. Without SMOKE_ADMIN_PASSWORD this script only exercises the
// OAuth/MCP flow (which was never gated) and skips the vault-HTTP checks.
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;

const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const redirectUri = "http://localhost:4567/callback";

const registration = await fetch(`${base}/oauth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ client_name: "DESK-OS smoke test", redirect_uris: [redirectUri] }),
}).then(async (response) => {
  if (!response.ok) throw new Error(`Registration failed: ${response.status} ${await response.text()}`);
  return response.json();
});

const authorize = new URL(`${base}/oauth/authorize`);
authorize.searchParams.set("response_type", "code");
authorize.searchParams.set("client_id", registration.client_id);
authorize.searchParams.set("redirect_uri", redirectUri);
authorize.searchParams.set("code_challenge", challenge);
authorize.searchParams.set("code_challenge_method", "S256");
authorize.searchParams.set("resource", `${base}/mcp`);
authorize.searchParams.set("scope", "mcp:tools offline_access");
authorize.searchParams.set("state", "smoke-state");

const approval = await fetch(authorize, { redirect: "manual" });
if (approval.status !== 302) throw new Error(`Automatic authorization failed: ${approval.status} ${await approval.text()}`);
const callback = new URL(approval.headers.get("location"));
if (callback.searchParams.get("state") !== "smoke-state") throw new Error("OAuth state mismatch");

const tokens = await fetch(`${base}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code", code: callback.searchParams.get("code"), client_id: registration.client_id,
    redirect_uri: redirectUri, code_verifier: verifier, resource: `${base}/mcp`,
  }),
}).then(async (response) => {
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  return response.json();
});

const mcpHeaders = {
  Authorization: `Bearer ${tokens.access_token}`,
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": "2025-06-18",
};

async function mcp(body) {
  const response = await fetch(`${base}/mcp`, { method: "POST", headers: mcpHeaders, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP request failed: ${response.status} ${text}`);
  return JSON.parse(text);
}

const initialized = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1.0.0" } } });
if (initialized.result?.serverInfo?.name !== "desk-os-obsidian-cloud") throw new Error("Unexpected MCP server identity");
const tools = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
const toolNames = tools.result?.tools?.map((tool) => tool.name) ?? [];
if (!toolNames.includes("obsidian_vault_info")) throw new Error("Expected legacy tool not found");
if (!toolNames.includes("desk_os_get_system_status")) throw new Error("Expected desk_os_* tool not found");

const status = await mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "desk_os_get_system_status", arguments: {} } });
if (status.result?.isError) throw new Error(`desk_os_get_system_status failed: ${JSON.stringify(status.result)}`);

let vaultChecks = "skipped (SMOKE_ADMIN_PASSWORD not set)";
if (adminPassword) {
  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPassword }),
  });
  if (!login.ok) throw new Error(`Admin login failed: ${login.status} ${await login.text()}`);
  const setCookie = login.headers.get("set-cookie");
  if (!setCookie) throw new Error("Admin login did not return a session cookie");
  const cookie = setCookie.split(";")[0];

  const archive = zipSync({ "SmokeVault/": new Uint8Array(), "SmokeVault/Projects/Smoke.md": strToU8("# Smoke\n\nRemote vault works.") });
  const imported = await fetch(`${base}/api/vault/import`, {
    method: "POST",
    headers: { "Content-Type": "application/zip", Cookie: cookie },
    body: archive,
  });
  if (!imported.ok || (await imported.json()).imported !== 1) throw new Error("Vault import failed");

  const vaultStatusResponse = await fetch(`${base}/api/vault/status`, { headers: { Cookie: cookie } });
  if (!vaultStatusResponse.ok) throw new Error("Vault status failed");
  const vaultStatus = await vaultStatusResponse.json();

  const exported = await fetch(`${base}/api/vault/export`, { headers: { Cookie: cookie } });
  if (!exported.ok || !(exported.headers.get("content-type") ?? "").includes("application/zip")) throw new Error("Vault export failed");

  const unauthenticated = await fetch(`${base}/api/vault/status`);
  if (unauthenticated.status !== 401) throw new Error(`Expected 401 without a session, got ${unauthenticated.status}`);

  await fetch(`${base}/api/admin/logout`, { method: "POST", headers: { Cookie: cookie } });
  vaultChecks = { importExport: "ok", vault: vaultStatus };
}

console.log(JSON.stringify({ oauth: "ok", mcp: "ok", tools: toolNames.length, deskOsTools: toolNames.filter((name) => name.startsWith("desk_os_")).length, vaultChecks }, null, 2));
