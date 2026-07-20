# AGENTS.md — Instructions for Claude Code

## Role

Act as the senior full-stack and MCP engineer responsible for evolving an existing production service safely.

## Non-negotiable rules

1. Preserve existing production behavior until regression tests exist.
2. Do not deploy to production without explicit approval from Leonardo Batista.
3. Do not expose secrets, vault content, tokens or admin credentials.
4. Do not remove current routes without a compatibility layer.
5. Do not create a second independent source of truth.
6. Keep domain logic independent of MCP, HTTP and UI adapters.
7. Every write operation must be authenticated, validated, idempotent where possible and audited.
8. Destructive or bulk operations require a proposal/approval boundary and backup.
9. Use TypeScript when the current code supports TypeScript or no maintainable typed layer exists.
10. Use modern Netlify Functions: default export, Web `Request`/`Response`, in-code `config`, `Netlify.env`.
11. Never place application code in `.netlify/`.
12. Prefer existing libraries and architecture before adding dependencies.
13. Do not migrate frontend frameworks unless the current frontend cannot be maintained.
14. Run locally with `netlify dev` or the existing framework command configured for Netlify primitives.
15. Treat all unverified assumptions as `GAP`, not fact.

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

The system must support:

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
→ E2E TESTS
→ DEPLOY PREVIEW
→ HUMAN APPROVAL
→ PRODUCTION
```

## Required final report

At the end of a development cycle provide:

- files changed;
- architecture decisions;
- tests executed and results;
- security implications;
- migrations performed;
- remaining gaps;
- preview URL;
- rollback procedure;
- explicit statement that production was or was not changed.
