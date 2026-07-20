# 09 — Security and Governance

## Authentication boundaries

1. MCP/OAuth client authorization.
2. Admin session.
3. Application/user authorization.
4. Storage access.
5. Bulk mutation approval.

Do not assume admin authentication is sufficient for all MCP clients.

## Required controls

- validate OAuth redirect URIs;
- state and PKCE where applicable;
- short-lived access tokens;
- secure token audience/issuer;
- refresh/revocation policy documented;
- rate limiting on login, token and MCP endpoints;
- `HttpOnly`, `Secure`, appropriate `SameSite` admin cookies;
- CSRF protection for cookie-authenticated writes;
- schema validation on every input;
- path traversal protection;
- upload type and size limits;
- authorization on every entity;
- optimistic concurrency;
- audit events;
- backups before bulk/destructive changes;
- no secrets in logs;
- no complete vault content in logs;
- separate preview and production secrets;
- secret scanning in CI.

## Human control

AI may:

- propose;
- classify;
- structure;
- validate;
- create a draft proposal.

AI must not, without explicit approval:

- apply a bulk decomposition;
- delete projects;
- overwrite vault content;
- export private content to a third party;
- send messages;
- publish;
- deploy production.

## Audit event minimum

```yaml
id: aud_xxx
timestamp: ISO-8601
actor:
  type: USER | ADMIN | MCP_CLIENT | SYSTEM
  id: string
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
```

## Data protection

- collect only necessary personal data;
- do not infer clinical conditions;
- support export;
- support deletion policy;
- document retention;
- keep tenant/user isolation even in single-user MVP so migration is possible.

## Threats to test

- unauthorized MCP tool call;
- expired/forged JWT;
- malicious OAuth redirect URI;
- CSRF on admin write;
- path traversal in vault path;
- oversized import;
- malformed frontmatter/JSON;
- duplicate apply request;
- stale version update;
- cyclic dependency;
- concurrent card moves;
- stored HTML/script injection;
- accidental production deployment.
