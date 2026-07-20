# Changelog

## 1.6.0 — 2026-07-19

### Added

- New MCP tool `desk_ingest_workflow_dashboard`.
- Replace and upsert ingestion modes with stable entity IDs.
- Structured state for sources, areas, decisions, gaps, counterevidence, risks, gate decision, and next action.
- Optional removal lists for incremental reconciliation.
- Optional `expectedStateSha256` optimistic-concurrency protection.
- Generated `WORKFLOW_STATUS.json`, `STATUS_DASHBOARD.html`, `DASHBOARD.md`, and immutable history snapshots.
- New `/dashboard` renderer restricted to signed, generated workflow dashboards.
- Script-free accessible charts and strict Content Security Policy.
- Dynamic dashboard discovery cards in the vault's main Dashboard tab.
- Reference payload for WorkOS Neuroadaptado under `templates/`.

### Validation

- TypeScript compilation passed.
- Seven test files and twenty-three tests passed.
- MCP catalog confirmed with 19 tools: 13 vault tools and 6 DESK-OS workflows.
- Dashboard state merge, removal, revision conflict, HTML escaping, and history were tested.

## 1.5.0 — 2026-07-19

### Added

- New MCP tool `obsidian_import_binary`.
- Exact Base64 import for ZIP skill packages, PDF, images, archives, and other binary files.
- Standard Base64, URL-safe Base64, and `data:...;base64,...` input support.
- MIME type and original filename provenance metadata in `FileRecord`.
- Optional incoming `expectedContentSha256` integrity verification.
- Safe overwrite using the destination `expectedSha256`; the displaced file moves to recoverable trash.
- Binary metadata, MIME type, and SHA-256 in vault listings and dashboard descriptors.
- Download responses prefer the stored MIME type.

### Limits

- 4,000,000 decoded bytes per MCP binary import.
- The connector stores the archive unchanged; it does not install, extract, or execute Skills.

### Validation

- TypeScript compilation passed.
- Six test files and twenty tests passed.
- Production dependency audit reported zero known vulnerabilities.
- MCP catalog confirmed with 18 tools: 13 vault tools and 5 DESK-OS workflows.

## 1.3.0 — 2026-07-19

### Added

- Integrated application shell with three tabs: **Dashboard**, **Notas**, and **Documentos**.
- Dynamic project map based on the vault's real top-level folders, with contextual DESK-OS descriptions and subfolder disclosure.
- Authenticated files API at `/api/vault/files` for catalog, reading, note creation, and safe text editing.
- Folder navigation, breadcrumbs, global path search, file metadata, Markdown reading, raw view, and authenticated download.
- Inline Markdown editor with explicit save, unsaved-change warnings, and SHA-256 conflict protection.
- Text-document editing for CSV, JSON, YAML, TXT, HTML, CSS, JavaScript, TypeScript, TOML, INI, and log files up to 1 MB.
- New-note dialog that creates `.md` files without overwriting existing paths.
- Legacy `/view` links now redirect to the integrated dashboard while raw-text and download actions remain available.
- MCP hyperlinks now open the corresponding file inside the **Notas** or **Documentos** tab.
- One new Netlify Function, `vault-files`, bringing the expected HTTP Function count from 12 to 13.

### Preserved

- Existing dashboard metrics, ZIP import/export, OAuth 2.1 + PKCE, administrative session, 17 MCP tools, recoverable trash, and Netlify Blobs storage.
- Safe server-side Markdown rendering; stored HTML remains escaped and is never executed.
- Binary documents remain read-only and available through authenticated download.

### Validation

- TypeScript compilation passed.
- Six test files and sixteen tests passed.
- Production dependency audit reported zero known vulnerabilities.
- Static application JavaScript passed `node --check`.
- Netlify CLI loaded all 13 Functions locally; a full local runtime smoke test could not finish because the CLI attempted an external Edge Functions fetch that is blocked in this execution environment.

## 1.2.0 — 2026-07-18

### Added

- Protected vault browser at `/view`.
- Permanent authenticated HTTPS links for every active file returned by MCP tools.
- `viewUrl` and `vaultBrowserUrl` fields in structured MCP results.
- Safe Markdown rendering with YAML properties, tables, lists, task checkboxes, code blocks, and Obsidian-style links.
- Authenticated raw-text and download actions.
- One new Netlify Function, `vault-view`, bringing the HTTP Function count from 11 to 12.

## 1.1.0 — 2026-07-18

### Added

- `desk_material_to_project`
- `desk_daily_next_action`
- `desk_evidence_to_decision`
- `desk_multisystem_dashboard`
- `desk_paper_to_digital`

## 1.4.0 — Open Access

- Remove solicitação de senha do dashboard.
- Remove validação de sessão das APIs do vault.
- Remove senha da autorização OAuth; o código é emitido automaticamente após validações PKCE.
- Mantém `MCP_JWT_SECRET` apenas para assinatura técnica de tokens.
- Remove `ADMIN_PASSWORD` do exemplo de ambiente.
