# Security model — open access edition

## Deliberate configuration

Version 1.6.0 retains the open-access configuration introduced in 1.4.0, controlled binary import from 1.5.0, and generated workflow dashboards.

- The dashboard and vault HTTP APIs are public.
- OAuth authorization is automatic after protocol validation and does not ask for a password.
- Dynamic Client Registration remains available.
- `ADMIN_PASSWORD` is not used.
- `MCP_JWT_SECRET` remains an internal signing key required by OAuth token integrity. It is not a login password and is never shown in the interface.

## Remaining safeguards

- OAuth still validates exact redirect URIs, resource audience, authorization codes and PKCE S256.
- Markdown is escaped before safe formatting.
- HTML, JavaScript, TypeScript and CSS files are displayed as text, never executed.
- Binary files remain download-only.
- Text editing is limited to 1 MB.
- Updates use `expectedSha256`; stale revisions return `409 CONFLICT`.
- Hidden paths, `.obsidian`, `.git`, traversal, absolute and null-byte paths are rejected.
- The MCP exposes no command-execution or permanent-delete tool.

## Exposure warning

Anyone with the public project URL can read, create, edit, import and export the remote vault. Search engines, link sharing, browser history, third-party clients and automated scanners may expose or alter data. Do not store confidential, personal, contractual, health, financial or regulated data in this open instance.


## Binary import safeguards

- Base64 is validated canonically before storage.
- Decoded payloads are limited to 4,000,000 bytes.
- Optional SHA-256 verification detects modified or truncated input.
- Existing destinations cannot be replaced without `overwrite=true` and the current `expectedSha256`.
- Replaced files are moved to recoverable trash.
- MIME type values are syntactically validated.
- Hidden, internal, absolute and traversal paths remain blocked.
- Imported ZIP and Skill packages are stored only; the server does not extract, execute or install them.
- Because the deployment is open access, anyone with the MCP connection can upload binary data and consume storage.


## Workflow dashboard safeguards

- Dashboard HTML is generated only from validated structured fields; user text is HTML-escaped.
- The generated dashboard contains no JavaScript and no external dependencies.
- `/dashboard` renders only paths under `DESK-OS/Dashboards/Workflows/` ending in `STATUS_DASHBOARD.html`.
- Renderable files must contain the DESK-OS server-generation marker.
- The renderer applies a Content Security Policy that blocks scripts, network connections, frames, forms and external assets.
- `expectedStateSha256` can prevent stale workflow-state updates.
- Every ingestion can create an audit snapshot under `history/`.
- The generated HTML is derived output; the JSON state is the source of truth.
