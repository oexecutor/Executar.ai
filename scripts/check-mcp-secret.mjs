#!/usr/bin/env node

const secret = process.env.MCP_JWT_SECRET;

if (typeof secret !== "string" || secret.trim() === "") {
  console.error("MCP CONFIG ERROR: MCP_JWT_SECRET is required in the Vercel environment.");
  process.exit(1);
}

const length = Buffer.byteLength(secret, "utf8");
if (length < 32) {
  console.error(`MCP CONFIG ERROR: MCP_JWT_SECRET must contain at least 32 bytes; received ${length}.`);
  process.exit(1);
}

console.log("MCP secret contract is valid.");
