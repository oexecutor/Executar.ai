# Security model — Vercel internal-MVP edition

## Current production boundary

The canonical deployment is the Vercel project `executar-ai` at
`https://executar-ai.vercel.app`.

**Update (DEC-001, 2026-07-28): real authentication is enforced by
default.** A request without a valid Supabase-backed session (bearer token
+ workspace membership, or the `executa_session` app cookie issued after
sign-in) is unauthenticated and gets `401`, not a shared public identity.
The full sign-in flow (email/password, Google OAuth, workspace picker) was
already built (`web/src/pages/Login.tsx`, `/api/auth/session`) and is now
the default path for every caller.

The previous **internal-MVP public workspace mode** — every session-less
request silently landing in a shared `public` workspace with role `OWNER` —
is now opt-in only, via `ALLOW_PUBLIC_WORKSPACE_FALLBACK=true`
(`src/lib/request-auth.ts`). Set it only for an owner-operated demo
deployment holding no private data; never on a deployment serving real
users. It doubles as the rollback switch if enforcing auth breaks a
deployment that does not yet have Supabase configured — see "Rollback"
below.

`/mcp` remains a separate protected resource and requires an OAuth bearer
token, unaffected by this change.

## Canonical authentication surfaces

### Application and Vault

The current application fallback is implemented in `src/lib/request-auth.ts`.
It provides the shared public workspace when no stronger identity is present.
Agents must not describe this fallback as tenant isolation or user
authentication.

### MCP

The canonical MCP endpoint is `/mcp` in this repository. It uses OAuth 2.1
patterns, bearer access tokens, resource metadata and PKCE. An unauthenticated
request should return `401` with `WWW-Authenticate`; this is expected behavior,
not a runtime failure.

A successful MCP OAuth flow authenticates a client, not necessarily a human
actor. Per-user authorization and workspace isolation remain separate product
requirements.

## Persistence boundary

- Vault and OAuth use Vercel Postgres/Neon through the existing store adapters.
- `SupabaseKvStore` is used only when Supabase is explicitly configured and a
  workspace scope is supplied.
- No storage migration or source-of-truth change may be made without an ADR,
  tested migration, rollback and data-integrity verification.

## Required safeguards

- validate OAuth redirect URIs, state, audience, issuer and PKCE S256;
- use short-lived access tokens and document revocation/refresh behavior;
- apply rate limiting to OAuth, MCP and any future login endpoints;
- validate every external input with an explicit schema;
- reject traversal, absolute, hidden, null-byte and reserved paths;
- enforce upload type, size and decompression limits;
- escape or sanitize rendered Markdown/HTML;
- display source code as text rather than executing it;
- keep binary files download-only;
- use optimistic concurrency for updates (`expectedSha256` or equivalent);
- preserve recoverable trash/backups for overwrite and bulk operations;
- emit audit evidence for consequential writes;
- never log secrets, bearer tokens or complete Vault content;
- keep preview and production secrets separate;
- protect `.env*` files and maintain `.env.example` without real credentials;
- inspect Vercel runtime errors after deployment;
- treat dependency audit findings as tracked risks, not as permission to run
  breaking `npm audit fix --force` automatically.

## Human approval boundary

AI may propose, classify, structure, validate, test and create reviewable
branches or pull requests.

Without explicit owner approval, AI must not:

- perform destructive or bulk data changes;
- permanently delete projects or Vault files;
- overwrite content without concurrency protection and backup;
- export private content to third parties;
- send external messages;
- publish content;
- deploy production;
- change the canonical storage backend;
- introduce a second MCP source of truth;
- enable public multi-user access while isolation is absent.

## Vault and import safeguards

- canonical Base64 validation before storage;
- decoded payload limit of 4,000,000 bytes unless a reviewed contract changes
  it;
- optional SHA-256 verification for imported content;
- replacement requires explicit `overwrite=true` and the current expected
  hash;
- replaced files go to recoverable trash;
- imported ZIP and Skill packages are stored only and are never automatically
  extracted, executed or installed;
- hidden, internal and traversal destinations remain blocked.

## Rendering safeguards

- generated dashboard fields and user text must be HTML-escaped;
- generated dashboards must not execute JavaScript or depend on untrusted
  external assets;
- render only allowlisted paths and expected file types;
- apply a restrictive Content Security Policy;
- treat structured JSON state as the source of truth and HTML as derived
  output.

## Rollback

If enforcing authentication breaks a deployment (most likely cause: Supabase
env vars not yet configured for that environment, so nobody can complete
sign-in), set `ALLOW_PUBLIC_WORKSPACE_FALLBACK=true` on that deployment to
immediately restore the previous shared-workspace behavior without a code
revert, then fix the underlying Supabase configuration before unsetting it
again. Check `/health` (`api/health.ts`) first — it reports whether Supabase
and Postgres are configured (presence only, never values).

## Launch security gates

Before public beta:

1. ~~replace the public fallback with real authentication~~ — **done**
   (DEC-001, 2026-07-28), see "Current production boundary" above;
2. isolate every workspace and entity by actor/tenant;
3. validate authorization for all read and write routes;
4. complete privacy/terms review;
5. execute security, access-control and cross-workspace tests;
6. document incident response, data export and deletion procedures.

## Current accepted risks

See `docs/release/04-RISCOS-DECISOES.md` for the binding risk register and
`docs/release/09-HOMOLOGACAO-G1-2026-07-25.md` for live production evidence.
