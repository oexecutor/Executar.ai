import crypto from "node:crypto";
import { strToU8, zipSync } from "fflate";

const base = process.env.SMOKE_BASE_URL;
if (!base) throw new Error("SMOKE_BASE_URL is required");

const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const redirectUri = "http://localhost:4567/callback";

const registration = await fetch(`${base}/oauth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ client_name: "DESK-OS open-access smoke test", redirect_uris: [redirectUri] }),
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
if (!tools.result?.tools?.some((tool) => tool.name === "obsidian_vault_info")) throw new Error("Expected tool not found");

const archive = zipSync({ "SmokeVault/": new Uint8Array(), "SmokeVault/Projects/Smoke.md": strToU8("# Smoke\n\nRemote vault works.") });
const imported = await fetch(`${base}/api/vault/import`, { method: "POST", headers: { "Content-Type": "application/zip" }, body: archive });
if (!imported.ok || (await imported.json()).imported !== 1) throw new Error("Vault import failed");
const status = await fetch(`${base}/api/vault/status`);
if (!status.ok) throw new Error("Vault status failed");
const vaultStatus = await status.json();
const exported = await fetch(`${base}/api/vault/export`);
if (!exported.ok || !(exported.headers.get("content-type") ?? "").includes("application/zip")) throw new Error("Vault export failed");

console.log(JSON.stringify({ oauth: "open", mcp: "ok", tools: tools.result.tools.length, dashboard: "open", importExport: "ok", vault: vaultStatus }, null, 2));
