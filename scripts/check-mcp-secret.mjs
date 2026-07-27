#!/usr/bin/env node

const MCP_PROJECT_PRODUCTION_HOSTS = new Set(["executar-ai.vercel.app"]);

function normalizeHostname(value) {
  if (typeof value !== "string" || value.trim() === "") return "";

  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const projectProductionHost = normalizeHostname(
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
);

if (!MCP_PROJECT_PRODUCTION_HOSTS.has(projectProductionHost)) {
  console.log(
    "MCP secret guard skipped: this Vercel project does not host the canonical MCP runtime.",
  );
  process.exit(0);
}

const secret = process.env.MCP_JWT_SECRET;

if (typeof secret !== "string" || secret.trim() === "") {
  console.error(
    "MCP CONFIG ERROR: MCP_JWT_SECRET is required for the canonical MCP runtime.",
  );
  process.exit(1);
}

const length = Buffer.byteLength(secret, "utf8");
if (length < 32) {
  console.error(
    `MCP CONFIG ERROR: MCP_JWT_SECRET must contain at least 32 bytes; received ${length}.`,
  );
  process.exit(1);
}

console.log("MCP secret contract is valid for the canonical MCP runtime.");
