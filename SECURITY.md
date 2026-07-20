# Security model — operator session edition

## Deliberate configuration

Version 1.7.0 replaces the open-access model introduced in 1.4.0 with an authenticated
operator session (Gate 0.5 of the DESK-OS PM handoff, baseline §13 Option B), while keeping
controlled binary import from 1.5.0 and generated workflow dashboards from 1.6.0.

- The vault HTTP APIs (`/api/vault/*`), the human viewer (`/view`) and the workflow
  dashboard (`/dashboard`) require an authenticated operator session.
- The session is issued by `POST /api/admin/login` after checking `ADMIN_PASSWORD`
  (compared as SHA-256 digests with `timingSafeEqual`) and is carried in a signed JWT
  cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, 8-hour expiry.
- Login fails closed: while `ADMIN_PASSWORD` is unset, no session can be created.
- `/health` remains public and returns no sensitive data.
- OAuth authorization for `/mcp` is automatic after protocol validation and authenticates
  the MCP client, not the operator. Dynamic Client Registration remains available.
- `MCP_JWT_SECRET` signs both OAuth access tokens and operator session cookies. It is not
  a login password and is never shown in the interface.

## Remaining safeguards

- OAuth still validates exact redirect URIs, resource audience, authorization codes and PKCE S256.
- Markdown is escaped before safe formatting.
- HTML, JavaScript, TypeScript and CSS files are displayed as text, never executed.
- Binary files remain download-only.
- Text editing is limited to 1 MB.
- Updates use `expectedSha256`; stale revisions return `409 CONFLICT`.
- Hidden paths, `.obsidian`, `.git`, traversal, absolute and null-byte paths are rejected.
- The MCP exposes no command-execution or permanent-delete tool.

## Exposure notes

- Anyone with the URL can reach the login form and the OAuth endpoints; everything else
  requires the operator session or a valid MCP access token.
- The MCP surface still authenticates *a client*, not a person: any client that completes
  Dynamic Client Registration and PKCE receives tool access. Treat the MCP URL itself as
  sensitive until per-actor authorization exists (out of MVP scope, DEC in baseline §13).

## Binary import safeguards

- Base64 is validated canonically before storage.
- Decoded payloads are limited to 4,000,000 bytes.
- Optional SHA-256 verification detects modified or truncated input.
- Existing destinations cannot be replaced without `overwrite=true` and the current `expectedSha256`.
- Replaced files are moved to recoverable trash.
- MIME type values are syntactically validated.
- Hidden, internal, absolute and traversal paths remain blocked.
- Imported ZIP and Skill packages are stored only; the server does not extract, execute or install them.
- ZIP import over HTTP now requires the operator session; MCP import requires an OAuth token.

## Workflow dashboard safeguards

- Dashboard HTML is generated only from validated structured fields; user text is HTML-escaped.
- The generated dashboard contains no JavaScript and no external dependencies.
- `/dashboard` renders only paths under `DESK-OS/Dashboards/Workflows/` ending in `STATUS_DASHBOARD.html`.
- Renderable files must contain the DESK-OS server-generation marker.
- The renderer applies a Content Security Policy that blocks scripts, network connections, frames, forms and external assets.
- `expectedStateSha256` can prevent stale workflow-state updates.
- Every ingestion can create an audit snapshot under `history/`.
- The generated HTML is derived output; the JSON state is the source of truth.
