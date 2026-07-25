# 13 — Decisions, Gaps and Assumptions

> Updated for the Vercel production architecture on 2026-07-25. The binding
> release risk register is `docs/release/04-RISCOS-DECISOES.md`.

## Binding decisions

| ID | Decision |
|---|---|
| DEC-001 | One shared domain core; MCP, HTTP and web are adapters. |
| DEC-002 | Preserve current OAuth, Vault and production behavior before refactoring. |
| DEC-003 | Vault remains the context and note system in the MVP. |
| DEC-004 | Operational state uses repository abstractions and canonical structured representations. |
| DEC-005 | Vercel Postgres/Neon is the current canonical Vault and OAuth persistence; scoped Supabase storage is used only when explicitly configured. |
| DEC-006 | Claude Skill remains the adaptive reasoning layer in the MVP. |
| DEC-007 | MCP validates and persists decomposition proposals; consequential application changes require explicit approval. |
| DEC-008 | The frontend is not a Linear clone; it implements DESK-OS core flows. |
| DEC-009 | No production deployment without Leonardo Batista's explicit approval. |
| DEC-010 | One dominant daily delivery, one active workflow default and up to three steps are product defaults. |
| DEC-011 | Vercel project `executar-ai` is the canonical production deployment; Netlify is historical only. |
| DEC-012 | The native `/mcp` implementation in `oexecutor/Executar.ai` is the only canonical MCP backend for this product. |
| DEC-013 | Public shared-workspace access is accepted only for internal MVP use and controlled demonstrations; authentication and isolation are required before public beta. |
| DEC-014 | Storage migrations require an ADR, tested migration, integrity evidence and rollback. |

## Resolved gaps

| ID | Former gap | Resolution |
|---|---|---|
| GAP-001 | Source code unavailable through deployment connector | GitHub repository `oexecutor/Executar.ai` is available and canonical. |
| GAP-002 | Persistence unknown | `src/lib/stores.ts` plus production Vault status confirm Vercel Postgres/Neon fallback and optional scoped Supabase. |
| GAP-003 | MCP tools unknown | Native registration lives in `src/mcp-server.ts` and related tool modules. |
| GAP-004 | Frontend framework unknown | Vite + React under `web/`. |
| GAP-005 | OAuth security details unknown | OAuth routes, metadata, token behavior and MCP challenge are implemented and production-checked. |
| GAP-006 | Admin session details unknown | Former operator-password gate is not the current access model; public internal-MVP fallback is documented in `SECURITY.md`. |
| GAP-007 | Environment-variable purpose unknown | `.env.example`, `src/lib/env.ts` and `scripts/check-env.mjs` define the current contract. |
| GAP-008 | Existing data schema unknown | Domain, Executar and Supabase schemas are present in source and migrations. |
| GAP-009 | Backup/rollback unknown | `docs/release/07-PLANO-DE-ROLLBACK.md` is the current runbook. |
| GAP-010 | CI/test coverage unknown | Baseline and commands are documented in `docs/release/06-PLANO-DE-TESTES.md` and `AGENTS.md`. |

## Open gaps

| ID | Gap | Required resolution |
|---|---|---|
| GAP-011 | Multi-user authentication and workspace isolation are absent from the current public fallback | implement and test before G6 public beta |
| GAP-012 | One e2e path involving `/icon.svg` was previously flaky | stabilize in G5 and keep regression evidence |
| GAP-013 | Privacy policy and terms have not been legally validated | owner/legal review before G7 |
| GAP-014 | Dependency audit reports high-severity findings in the web dependency tree | triage without automatic breaking upgrades; create a controlled remediation plan |
| GAP-015 | Historical Netlify references may remain outside the files updated in G1 | search and mark remaining references as historical or migrate them |
| GAP-016 | AMES skill package PR #4 belongs to the plugin/skill source of truth rather than the application runtime | migrate deliberately to the plugin suite before closing the draft PR |

## Assumptions to validate

- a single-owner internal MVP is sufficient until authentication is restored;
- current Vault data can support stable entity references;
- Vercel Functions can support the expected production workload and limits;
- the current Vite/React UI can be incrementally extended;
- Claude Skill can reliably output the proposed decomposition schema;
- a five-day sprint remains the correct default for the first user workflow;
- keeping the temporary persistence split until G3 is lower risk than migrating during hotfix stabilization.

Do not convert an assumption into architecture without recording evidence and a
binding decision.
