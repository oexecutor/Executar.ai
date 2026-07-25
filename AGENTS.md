# AGENTS.md — Instructions for coding agents

## Role

Act as the senior full-stack, Vercel and MCP engineer responsible for evolving
an existing production service safely.

## Canonical context

- Repository: `oexecutor/Executar.ai`.
- Default branch: `main`.
- Production platform: **Vercel**.
- Vercel project: `executar-ai`.
- Production URL: `https://executar-ai.vercel.app`.
- Canonical MCP endpoint: `https://executar-ai.vercel.app/mcp`.
- Current release source of truth: `docs/release/README.md` and the newest
  numbered homologation document in `docs/release/`.
- Historical documents that describe Netlify or an operator-password gate are
  not operational instructions unless explicitly marked current.

## Non-negotiable rules

1. Preserve existing production behavior until regression tests exist.
2. Do not deploy to production without explicit approval from Leonardo Batista.
3. Do not expose secrets, vault content, tokens or credentials.
4. Do not remove current routes without a compatibility layer.
5. Do not create a second independent source of truth.
6. Keep domain logic independent of MCP, HTTP, Vercel and UI adapters.
7. Every write operation must be authenticated or explicitly classified as an
   accepted internal-MVP exception, validated, idempotent where possible and
   audited.
8. Destructive or bulk operations require a proposal/approval boundary and a
   recoverable backup.
9. Use TypeScript when the current code supports it.
10. Implement Vercel Functions under `api/*.ts`. Web `Request`/`Response`
    handlers must be adapted through the existing Vercel Node adapter pattern;
    do not return a Web `Response` directly from a Node-style default export.
11. Never introduce Netlify Functions, `Netlify.env`, `.netlify/` application
    code or `netlify dev` into the current architecture.
12. Prefer existing libraries and architecture before adding dependencies.
13. Do not migrate frontend frameworks unless the existing Vite/React frontend
    cannot be maintained.
14. Run the integrated service with `npm run dev` (`vercel dev`).
15. Treat all unverified assumptions as `GAP`, not fact.
16. The native `/mcp` implementation in this repository is canonical. Do not
    connect or create a parallel standalone MCP backend for the same product.
17. Production currently allows a public single-owner workspace for internal
    MVP use. Do not treat that as safe multi-user authorization. Do not place
    private third-party data there. Authentication and workspace isolation are
    required before public beta.
18. Vault and OAuth currently use Vercel Postgres/Neon unless Supabase is
    explicitly configured for a scoped workspace. Do not migrate or unify
    storage without an ADR, tested migration and rollback plan.

## Product rules

- one dominant delivery visible per day;
- at most three visible execution steps per task;
- one active workflow by default;
- low information density;
- no infinite or horizontal scrolling in core flows;
- visible keyboard focus and sufficient contrast;
- reduced motion support;
- autosave with explicit sync state;
- printable A4 summary;
- no artificial urgency or manipulative notifications;
- no clinical claims.

## Epistemic record types

The system and its documentation must distinguish:

- FACT;
- EVIDENCE;
- INFERENCE;
- HYPOTHESIS;
- COUNTEREVIDENCE;
- GAP;
- DECISION.

## Required work sequence

```text
BASELINE
→ TEST CURRENT BEHAVIOR
→ DOMAIN MODEL
→ REPOSITORY ADAPTER
→ APPLICATION SERVICES
→ MCP TOOLS
→ HTTP API
→ WEB UI
→ UNIT / INTEGRATION / E2E TESTS
→ DEPLOY PREVIEW
→ VERIFY VERCEL LOGS AND ROUTES
→ HUMAN APPROVAL
→ PRODUCTION
→ POST-DEPLOY SMOKE TEST
```

## Minimum verification commands

```bash
npm run env:check
npm run build
npm test
npm run lint
npm run build:web
npm run test:web
npm run lint:web
```

Run `npm run test:web:e2e` when the change affects user flows. Run
`npm run test:smoke` only with an explicitly supplied `SMOKE_BASE_URL`.

## Production verification

A green deployment is necessary but not sufficient. For affected routes:

1. confirm the Vercel deployment is `READY`;
2. inspect build and runtime errors;
3. call the production or preview endpoint;
4. verify the expected status, response contract and security headers;
5. record the evidence in `docs/release/` or the pull request.

## Required final report

At the end of a development cycle provide:

- files changed;
- architecture decisions;
- tests executed and results;
- deployment and route verification;
- security implications;
- migrations performed;
- remaining gaps;
- preview or production URL;
- rollback procedure;
- explicit statement that production was or was not changed.
