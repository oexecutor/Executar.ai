# Deployment status — superseded historical record

> This document originally described the Netlify deployment from 2026-07-19.
> Netlify is no longer the production target. The current source of truth is
> [`docs/release/README.md`](./release/README.md), with the latest live evidence
> in [`docs/release/09-HOMOLOGACAO-G1-2026-07-25.md`](./release/09-HOMOLOGACAO-G1-2026-07-25.md).

## Current production target

- Platform: **Vercel**.
- Project: `executar-ai`.
- Repository: `oexecutor/Executar.ai`.
- Branch: `main`.
- Production URL: `https://executar-ai.vercel.app`.
- MCP URL: `https://executar-ai.vercel.app/mcp`.
- Runtime: Vercel Functions under `api/*.ts`.
- Persistence: Vercel Postgres/Neon for Vault and OAuth, with scoped Supabase
  support only when explicitly configured.

## Homologated state — 2026-07-25

- Vercel production deployment reached `READY`.
- `/api/auth/me` returned `200`.
- `/api/executar/projects` returned `200` with the current portfolio.
- `/api/vault/status` returned `200` and identified Vercel Postgres storage.
- `/api/vault/files` returned `200` with five files and valid deep-link URLs.
- direct Vault file loading by `path` returned `200` with content.
- `/mcp` returned the expected OAuth `401` challenge instead of a runtime 500.
- no Vault runtime error cluster was found in the checked 24-hour window.

## Historical Netlify target

The previous values below are retained only for traceability and must not be
used by agents or deployment workflows:

- former project: `desk-os-vault-mcp-openai`;
- former URL: `https://desk-os-vault-mcp-openai.netlify.app`;
- former execution model: Netlify Functions and Blobs.

Do not run `netlify dev`, create Netlify Functions or deploy the current
application to the historical project.
