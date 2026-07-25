# 09 — Security and Governance

> Current platform: Vercel project `executar-ai`. Binding operational security
> details are in `SECURITY.md`; binding release risks and decisions are in
> `docs/release/04-RISCOS-DECISOES.md`.

## Current authentication boundaries

1. MCP/OAuth client authorization.
2. Application identity and workspace authorization.
3. Storage access and workspace scope.
4. Bulk mutation approval.
5. Production deployment approval.

The former operator-password session is not the current application boundary.
The internal MVP presently falls back to a shared `public` workspace with role
`OWNER`. This fallback must not be described as multi-user authentication or
isolation.

MCP authorization is independent: `/mcp` requires a bearer token and should
return an OAuth challenge to unauthenticated clients.

## Required controls

- validate OAuth redirect URIs;
- state and PKCE S256 where applicable;
- short-lived access tokens;
- secure token audience and issuer;
- refresh and revocation policy documented;
- rate limiting on token, OAuth, MCP and future login endpoints;
- `HttpOnly`, `Secure` and appropriate `SameSite` cookies if cookie sessions
  are reintroduced;
- CSRF protection for cookie-authenticated writes;
- schema validation on every input;
- path traversal and reserved-path protection;
- upload type, size and decompression limits;
- authorization on every entity before public beta;
- optimistic concurrency;
- audit events;
- backups before bulk or destructive changes;
- no secrets in logs;
- no complete Vault content in logs;
- separate preview and production secrets;
- secret scanning in CI;
- Vercel build and runtime log verification after deploy;
- ADR plus rollback before storage migration.

## Human control

AI may:

- propose;
- classify;
- structure;
- validate;
- test;
- create a draft proposal;
- create a reviewable branch or pull request when authorized.

AI must not, without explicit approval:

- apply a bulk decomposition;
- delete projects;
- permanently delete or overwrite Vault content;
- export private content to a third party;
- send messages;
- publish;
- deploy production;
- change the canonical persistence backend;
- create or connect a second MCP backend;
- expose a multi-user beta before workspace isolation exists.

## Audit event minimum

```yaml
id: aud_xxx
timestamp: ISO-8601
actor:
  type: USER | ADMIN | MCP_CLIENT | SYSTEM
  id: string
workspace_id: string | null
operation: string
entity_type: string
entity_ids: []
request_id: string
idempotency_key: string
before_version: integer | null
after_version: integer | null
result: SUCCESS | PARTIAL | ERROR
warnings: []
backup_ref: string | null
deployment_ref: string | null
```

## Data protection

- collect only necessary personal data;
- do not infer or claim clinical conditions;
- do not place private third-party data in the shared public workspace;
- support export;
- support deletion and retention policy;
- isolate data by workspace before public beta;
- document processors and storage locations;
- validate privacy policy and terms before public launch.

## Current canonical sources

- runtime and agent rules: `AGENTS.md`;
- security model: `SECURITY.md`;
- release status: `docs/release/README.md`;
- live G1 evidence: `docs/release/09-HOMOLOGACAO-G1-2026-07-25.md`;
- risks and decisions: `docs/release/04-RISCOS-DECISOES.md`.
