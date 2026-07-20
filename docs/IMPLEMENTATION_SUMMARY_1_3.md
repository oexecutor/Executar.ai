# Implementation summary — 1.3.0

## User-visible result

The original dashboard remains the entry point. A persistent top navigation adds **Dashboard**, **Notas**, and **Documentos**.

- Dashboard: metrics, ZIP import/export, MCP address, and dynamic project-folder cards.
- Notas: folder navigation, search, Markdown rendering, new-note creation, inline editing, and saving.
- Documentos: folder navigation, text reading/editing, and authenticated download for binary files.

## Server changes

- New Function: `netlify/functions/vault-files.mts`.
- New endpoint: `/api/vault/files`.
- Generic safe-text update method: `BlobVaultService.updateTextFile`.
- MCP and Markdown internal links now open files inside the integrated application.
- `/view` remains available for authenticated raw text and downloads and redirects normal reads to the integrated application.

## Safety behavior

- Editing requires an authenticated administrative session.
- PUT requires the exact `expectedSha256` from the latest read.
- Binary or oversized files cannot be edited.
- New files from the UI are restricted to `.md` notes and never overwrite existing paths.
