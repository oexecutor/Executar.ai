#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredVariables = [
  "PUBLIC_BASE_URL",
  "MCP_JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
];

const editorialE2Variables = [
  "EDITORIAL_GITHUB_TOKEN",
  "EDITORIAL_GITHUB_REPOSITORY",
  "EDITORIAL_GITHUB_BASE_BRANCH",
  "EDITORIAL_VERCEL_TOKEN",
  "EDITORIAL_VERCEL_PROJECT_ID",
  "EDITORIAL_VERCEL_TEAM_ID",
];
const optionalVariables = ["ADMIN_PASSWORD", "SMOKE_BASE_URL", ...editorialE2Variables];
const runtimeMode = process.argv.includes("--runtime");
const editorialE2Mode = process.argv.includes("--editorial-e2");

function fail(messages) {
  for (const message of messages) {
    console.error(`ENV ERROR: ${message}`);
  }
  process.exit(1);
}

function parseTemplate() {
  const templatePath = resolve(process.cwd(), ".env.example");
  const content = readFileSync(templatePath, "utf8");
  const names = new Set();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator > 0) names.add(trimmed.slice(0, separator).trim());
  }

  return names;
}

const declaredVariables = parseTemplate();
const missingFromTemplate = [...requiredVariables, ...optionalVariables].filter(
  (name) => !declaredVariables.has(name),
);

if (missingFromTemplate.length > 0) {
  fail(missingFromTemplate.map((name) => `${name} is missing from .env.example`));
}

if (!runtimeMode && !editorialE2Mode) {
  console.log("Environment contract is valid: .env.example declares all expected variables.");
  process.exit(0);
}

const requiredForInvocation = [
  ...(runtimeMode ? requiredVariables : []),
  ...(editorialE2Mode ? editorialE2Variables : []),
];
const missingRuntimeVariables = requiredForInvocation.filter((name) => {
  const value = process.env[name];
  return typeof value !== "string" || value.trim() === "";
});

const invalidRuntimeVariables = [];

for (const name of ["PUBLIC_BASE_URL", "SUPABASE_URL", "DATABASE_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    new URL(value);
  } catch {
    invalidRuntimeVariables.push(`${name} must be a valid URL`);
  }
}

if (
  process.env.MCP_JWT_SECRET &&
  Buffer.byteLength(process.env.MCP_JWT_SECRET, "utf8") < 32
) {
  invalidRuntimeVariables.push("MCP_JWT_SECRET must contain at least 32 bytes");
}

const publicPrefixes = ["VITE_", "NEXT_PUBLIC_"];
for (const privateName of [
  "MCP_JWT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "EDITORIAL_GITHUB_TOKEN",
  "EDITORIAL_VERCEL_TOKEN",
]) {
  if (publicPrefixes.some((prefix) => privateName.startsWith(prefix))) {
    invalidRuntimeVariables.push(`${privateName} must not use a public browser prefix`);
  }
}

if (
  process.env.EDITORIAL_GITHUB_REPOSITORY
  && !/^[^/\s]+\/[^/\s]+$/.test(process.env.EDITORIAL_GITHUB_REPOSITORY)
) {
  invalidRuntimeVariables.push("EDITORIAL_GITHUB_REPOSITORY must use owner/name");
}
if (
  process.env.EDITORIAL_VERCEL_PROJECT_ID
  && !process.env.EDITORIAL_VERCEL_PROJECT_ID.startsWith("prj_")
) {
  invalidRuntimeVariables.push("EDITORIAL_VERCEL_PROJECT_ID must start with prj_");
}
if (
  process.env.EDITORIAL_VERCEL_TEAM_ID
  && !process.env.EDITORIAL_VERCEL_TEAM_ID.startsWith("team_")
) {
  invalidRuntimeVariables.push("EDITORIAL_VERCEL_TEAM_ID must start with team_");
}

if (missingRuntimeVariables.length || invalidRuntimeVariables.length) {
  fail([
    ...missingRuntimeVariables.map((name) => `${name} is required at runtime`),
    ...invalidRuntimeVariables,
  ]);
}

console.log(editorialE2Mode
  ? "Editorial E2 environment is valid."
  : "Runtime environment is valid.");
