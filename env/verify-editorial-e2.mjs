#!/usr/bin/env node

const required = [
  "EDITORIAL_GITHUB_TOKEN",
  "EDITORIAL_GITHUB_REPOSITORY",
  "EDITORIAL_GITHUB_BASE_BRANCH",
  "EDITORIAL_VERCEL_TOKEN",
  "EDITORIAL_VERCEL_PROJECT_ID",
  "EDITORIAL_VERCEL_TEAM_ID",
];

const placeholderPattern = /TOKEN_PRIVADO|NAO_COMMITAR|REPLACE|CHANGEME/i;
const errors = [];

for (const name of required) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    errors.push(`${name}: ausente`);
    continue;
  }
  if (placeholderPattern.test(value)) {
    errors.push(`${name}: ainda contém placeholder`);
  }
}

if (
  process.env.EDITORIAL_GITHUB_REPOSITORY
  && process.env.EDITORIAL_GITHUB_REPOSITORY !== "oexecutor/P1.Executar.ai"
) {
  errors.push("EDITORIAL_GITHUB_REPOSITORY: repositório inesperado");
}

if (
  process.env.EDITORIAL_GITHUB_BASE_BRANCH
  && process.env.EDITORIAL_GITHUB_BASE_BRANCH !== "main"
) {
  errors.push("EDITORIAL_GITHUB_BASE_BRANCH: deve ser main");
}

if (
  process.env.EDITORIAL_VERCEL_PROJECT_ID
  && process.env.EDITORIAL_VERCEL_PROJECT_ID
    !== "prj_vA765A0ctnjhBILMEe9Mw5ClWuJu"
) {
  errors.push("EDITORIAL_VERCEL_PROJECT_ID: projeto inesperado");
}

if (
  process.env.EDITORIAL_VERCEL_TEAM_ID
  && process.env.EDITORIAL_VERCEL_TEAM_ID
    !== "team_td1WYpI56N0p0CFjzY9iMD5L"
) {
  errors.push("EDITORIAL_VERCEL_TEAM_ID: equipe inesperada");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ENV E2 ERROR: ${error}`);
  process.exit(1);
}

console.log("Editorial E2: configuração válida; tokens presentes e não exibidos.");
