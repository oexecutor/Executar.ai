# IMPLEMENTATION_BASELINE.md

**Status:** Pre-filled from direct source inspection + security audit, dated 2026-07-20.
**Supersedes:** `docs/13_DECISIONS_GAPS_ASSUMPTIONS.md` GAP-001 through GAP-010 (all resolved below).
**Produced outside Claude Code**, by a separate reviewer with access to the actual source archive
(`Código_do_mcp_atual_.zip`, deploy `6a5d3bec2c8afd48f16da2bd`). Claude Code should still perform its
own Gate 0 verification steps (build, test, `netlify dev`, smoke tests) — this document removes the
_investigation_ work, not the _verification_ work.

This file is meant to be dropped into the recovered repository at `docs/IMPLEMENTATION_BASELINE.md`,
exactly where `00_START_HERE.md` and `AGENTS.md` require it as the Gate 0 output.

---

## 0. How this changes the handoff

The handoff package (`DESK_OS_MCP_PM_HANDOFF_v1.0.0`) was written **without source access** — every
gap in `docs/13_DECISIONS_GAPS_ASSUMPTIONS.md` and every "unknown" in `contracts/current-runtime-map.json`
reflects that. This document closes those gaps with facts, and adds **one new, blocking finding** that
the original handoff could not have anticipated:

> **The current production service has no authentication on any vault-mutating HTTP route.**
> `verifyAdminRequest()` and `verifyAdminPassword()` are hardcoded to return `true`. This is not an
> oversight — it was a deliberate, documented change in v1.4.0 ("Acesso aberto"). It directly
> contradicts `AGENTS.md` non-negotiable rule 7 ("Every write operation must be authenticated"), and
> it is incompatible with storing Leonardo's real project data (evidence, decisions, tasks) once this
> becomes a multi-surface PM system. See §7 and §13 — this needs an explicit decision before Gate 1.

Everything else in the handoff (domain model, MCP tool design rules, gate structure, product scope)
holds up well against the real code and needs no structural change.

---

## 1. Actual repository inventory

```text
.
├── SECURITY.md                       # honest, already documents the open-access model
├── README.md / CHANGELOG.md          # CHANGELOG shows full version history back to 1.2.0
├── package.json                      # npm, Node >=20, TypeScript, vitest
├── tsconfig.json
├── netlify.toml                      # build = "npm run build" (tsc --noEmit), publish = "public"
├── .env.example                      # PUBLIC_BASE_URL, MCP_JWT_SECRET only
├── src/
│   ├── mcp-server.mts                # createMcpServer() — all 19 tool registrations
│   └── lib/
│       ├── auth.mts                  # JWT sign/verify, PKCE, admin stubs (see §7)
│       ├── env.mts                   # Netlify.env wrapper, requiredEnv()
│       ├── http.mts                  # json/html/methodNotAllowed/safeError/escapeHtml
│       ├── types.mts                 # FileRecord, TrashRecord, OAuthClient, AuthorizationCode
│       ├── stores.mts                # Netlify Blobs store factory (prod vs preview scoping)
│       ├── vault.mts                 # BlobVaultService — canonical persistence (see §5)
│       ├── viewer.mts                # hand-rolled Markdown→HTML renderer + HTML shell/pages
│       └── workflow-dashboard.mts    # DESK-OS workflow state → generated dashboard HTML
├── netlify/functions/                # 14 functions, one file each, Web Request/Response style
│   ├── health.mts
│   ├── mcp.mts
│   ├── oauth-metadata.mts
│   ├── oauth-register.mts
│   ├── oauth-authorize.mts
│   ├── oauth-token.mts
│   ├── admin-login.mts               # now a no-op that returns {authenticated:true} unconditionally
│   ├── admin-logout.mts              # same
│   ├── vault-status.mts
│   ├── vault-files.mts               # GET/POST/PUT — list/read/create/edit, UNAUTHENTICATED
│   ├── vault-import.mts              # ZIP import, UNAUTHENTICATED
│   ├── vault-export.mts              # ZIP export, UNAUTHENTICATED
│   ├── vault-view.mts                # /view — human browser, UNAUTHENTICATED
│   └── workflow-dashboard.mts        # /dashboard — generated HTML viewer, UNAUTHENTICATED
├── public/index.html                 # SPA-ish dashboard/notes/documents shell, calls /api/vault/*
├── public/privacy.html
├── scripts/smoke-oauth.mjs           # existing OAuth smoke test — reuse in Gate 0/6
├── tests/                            # vitest: vault, viewer, auth, mcp-server, workflows,
│                                      #         workflow-dashboard, dashboard (7 files)
├── templates/WORKOS_NEUROADAPTADO_INITIAL_PAYLOAD.json
└── docs/ (existing project docs, DASHBOARD_1_3.md, OPEN_ACCESS_1_4.md, BINARY_IMPORT_1_5.md, etc.)
```

**Package manager:** npm. **Build:** `tsc --noEmit` (type-check only — no bundling step; Netlify's
`esbuild` bundler handles function packaging at deploy time). **Test:** `vitest run`.
**Scripts confirmed in `package.json`:**

```json
{
  "dev": "npx netlify dev",
  "build": "tsc --noEmit",
  "test": "vitest run",
  "test:smoke": "node scripts/smoke-oauth.mjs",
  "check": "npm run build && npm test"
}
```

This already satisfies `docs/12_DEPLOY_RUNBOOK.md`'s "Required scripts" section almost exactly. Only
`lint` and `test:e2e` are missing — add them in Gate 6, don't restructure the existing ones.

**Framework:** none — plain Netlify Functions + hand-written HTML/JS in `public/index.html`. There is
**no React/Vite/Next.js frontend to preserve or migrate**. Per `docs/04_TARGET_ARCHITECTURE.md`'s own
fallback rule ("Vite + React + TypeScript... only when no maintainable framework exists"), the fallback
stack applies — this is not a judgment call, the current frontend is a single hand-rolled HTML file with
inline `<script>`, which cannot host a Kanban/board with drag-and-drop, routing, and optimistic UI at
reasonable effort. **Recommendation for Gate 5: introduce Vite + React + TypeScript as a new frontend
build, served as a static site, calling the existing/extended HTTP API. This is a net-new addition, not
a migration** — `public/index.html` can be preserved as-is (or redirected) since it only talks to
`/api/vault/*`, which stays stable per DEC-002.

---

## 2. Actual routes/functions (confirms `contracts/current-runtime-map.json` — zero drift)

All 14 functions and their paths match `current-runtime-map.json` exactly. No hidden routes were found.
Two additions worth noting that the black-box audit could not see:

- `vault-files.mts` handles **three HTTP methods on one path** (`GET` list/read, `POST` create note,
  `PUT` edit note/text file) — this is the richest route and the one the new PM HTTP API should sit
  next to, following its existing error-shape conventions (`{error:{code,message,suggestion}}`).
- `workflow-dashboard.mts` (`/dashboard`) already implements an allowlisted-path + generated-marker +
  strict-CSP rendering pattern for structured state → HTML. This is a **reusable pattern** for the new
  Kanban/Today read-only surfaces if you want a no-JS fallback view; the interactive board should still
  be the new React app.

---

## 3. Actual MCP tool catalog (resolves GAP-003) — 19 tools registered today

From `src/mcp-server.mts`, confirmed against `CHANGELOG.md` 1.6.0 ("19 tools: 13 vault tools and 6
DESK-OS workflows"):

**Vault tools (13, prefix `obsidian_`):**
`obsidian_vault_info`, `obsidian_list_entries`, `obsidian_read_note`, `obsidian_search_notes`,
`obsidian_create_note`, `obsidian_import_binary`, `obsidian_update_note`, `obsidian_update_frontmatter`,
`obsidian_move_entry`, `obsidian_copy_entry`, `obsidian_trash_entry`, `obsidian_list_trash`,
`obsidian_restore_trash`.

**DESK-OS workflow tools (6, prefix `desk_`):**
`desk_material_to_project`, `desk_daily_next_action`, `desk_evidence_to_decision`,
`desk_multisystem_dashboard`, `desk_ingest_workflow_dashboard`, `desk_paper_to_digital`.

### Naming collision with the handoff's proposed catalog

`contracts/mcp-tools.yaml` proposes a **third prefix**, `desk_os_*` (e.g. `desk_os_get_today`,
`desk_os_create_project`). None of these 19 tools use that prefix, and none of them implement
project/sprint/task semantics — the current `desk_*` tools are document/dashboard generators (they
write formatted Markdown/JSON into the vault; they do not model a Project/Sprint/Task domain with
IDs, versions, or status transitions).

**This is not a rename job.** Per `AGENTS.md` rule 4 ("do not remove current routes without a
compatibility layer") and DEC-002, the 19 existing tools must keep working for existing MCP clients
(Leonardo's current Claude Skill likely already calls some of them). The new `desk_os_*` catalog is
**additive**: register it alongside the existing 19 tools in the same `createMcpServer()`, backed by
the new domain/application-service layer from Gate 1–3. Do not repurpose or rename `desk_*` — those
stay as-is; they solve a different problem (structured document generation) than the new PM domain
(structured operational records with lifecycle).

---

## 4. Actual persistence (resolves GAP-002, GAP-008) — Netlify Blobs, no database

`src/lib/stores.mts` defines two scoped stores via `@netlify/blobs`:

```text
vaultStore()  → "obsidian-vault-production" | "obsidian-vault-preview" (deploy-scoped in preview)
oauthStore()  → "obsidian-oauth-production" | "obsidian-oauth-preview"
```

Both use `consistency: "strong"`. Key schema inside `vaultStore()`:

```text
file/<encodeURIComponent(path)>   → FileRecord  { path, data(base64), sizeBytes, sha256, modifiedAt, mimeType?, originalName? }
trash/<trashId>                   → TrashRecord { trashId, originalPath, trashedAt, file: FileRecord }
```

Inside `oauthStore()`:

```text
client/<clientId>                 → OAuthClient
code/<sha256(code)>                → AuthorizationCode (5 min TTL)
refresh/<sha256(refresh_token)>    → RefreshGrant (30 day TTL, rotated on use)
```

**Implication for Gate 2 (repository abstraction):** there is no existing "operational state" store —
everything today is a flat file blob keyed by vault path. `docs/04_TARGET_ARCHITECTURE.md`'s proposed
`.desk-os/state/{projects,sprints,tasks,evidence,proposals}/` layout maps cleanly onto this: each
Project/Sprint/Task/Evidence/Proposal becomes its own JSON file under a `.desk-os/` vault prefix, using
the **existing** `BlobVaultService.putBytes/getRecord/allRecords` primitives (already have SHA-256,
`expectedSha256` optimistic concurrency, and soft-delete via `trash()`). **Do not introduce a second
store or a database for MVP** — DEC-005 and the actual code agree. One required change:
`normalizeVaultPath`'s `ALWAYS_PROTECTED` set currently blocks any path segment starting with `.`
(including a literal `.desk-os` folder, since `.` is disallowed). **Gate 2 must add an explicit,
narrowly-scoped exception** for a `.desk-os/` prefix (or pick a non-dot folder name like `_desk-os/`)
— do not weaken the existing `.obsidian`/`.git`/hidden-path protection to do this.

**`allRecords()` fan-out (real performance risk, not hypothetical):** every list/search/info/export call
does one blob `get` per file, sequentially. Today this is tolerable at small vault sizes. Once the PM
domain adds Projects/Sprints/Tasks/Evidence/Proposals/Audit as more files in the same store, `allRecords()`
will be called far more often (board reads, Today reads, MCP read tools). **Gate 2 acceptance criteria
must include a fix for this** (e.g. a maintained index/manifest blob per record type, or prefix-scoped
listing instead of "list everything then filter in memory") — this is not optional polish, it's a
correctness-adjacent scaling bug that will surface as soon as the PM domain is layered on.

---

## 5. Actual OAuth implementation quality (resolves GAP-005)

Confirmed solid: PKCE **S256 mandatory** (`code_challenge_method !== "S256"` is rejected), exact
`redirect_uri` match against registered client, `resource`/audience binding checked on both `/authorize`
and `/token`, one-time authorization codes (deleted after exchange), refresh tokens rotated on use,
constant-time secret comparison (`crypto.timingSafeEqual`), JWT signed with issuer/audience/expiry/jti.

**One structural point to carry into `docs/09_SECURITY_AND_GOVERNANCE.md`'s threat list:**
`/oauth/authorize` auto-issues an authorization code to **any client that passes Dynamic Client
Registration** — there is no login screen, no consent screen, no user-identity check. Combined with
open `/oauth/register`, this means OAuth today authenticates _a client_, not _Leonardo_. That's an
acceptable model for a single-operator MCP connector, but it means **OAuth cannot be the sole answer**
to "who is allowed to call `desk_os_apply_decomposition`" once the HTTP/web surface (used by anyone with
the URL) sits on the same data. This reinforces §7 below rather than duplicating it.

---

## 6. `obsidian` environment variable (resolves GAP-007)

Grepped the entire source tree: **not referenced anywhere in code.** Only `PUBLIC_BASE_URL` and
`MCP_JWT_SECRET` are read via `requiredEnv()`. `ADMIN_PASSWORD` is likewise unread — and the project's
own `README.md`, `SECURITY.md`, and `docs/OPEN_ACCESS_1_4.md` already say it "should be removed from
Netlify." Treat `obsidian` the same way: **dead/legacy, safe to remove from the Netlify dashboard**,
not a hidden integration point. Confirm before deleting (Netlify env vars aren't in this source archive),
but do not architect around it as if it does something.

---

## 7. Admin authentication reality (resolves GAP-006) — THE finding

```ts
// src/lib/auth.mts
export function verifyAdminPassword(_password: string): boolean {
  return true;
}
export async function verifyAdminRequest(_request: Request): Promise<boolean> {
  return true;
}
```

`admin-login.mts` and `admin-logout.mts` are no-ops that return `{authenticated:true, accessMode:"open",
passwordRequired:false}` regardless of input. No cookie is verified on any request. **Every route under
`/api/vault/*`, `/view`, and `/dashboard` is reachable by anyone with the URL, with full read/write.**

This is confirmed **intentional and documented** — `CHANGELOG.md` 1.4.0 and `docs/OPEN_ACCESS_1_4.md`
describe this as a deliberate pivot ("Acesso aberto") away from the password-gated model that existed
in 1.3.0 (`vault-files.mts` was originally "authenticated," per the 1.3.0 changelog entry). `SECURITY.md`
even states the exposure plainly: _"Anyone with the public project URL can read, create, edit, import
and export the remote vault... Do not store confidential, personal, contractual, health, financial or
regulated data in this open instance."_

**That last sentence is now in direct tension with the mission of this handoff.** The PM domain being
built on top of this vault will store exactly the kind of data that sentence warns against: Leonardo's
real projects, evidence, decisions, and operational history. Continuing to "preserve current behavior"
here (per Gate 0's literal instruction) means **preserving public read/write access to that data**,
which is very likely not what "preserve current behavior" was meant to protect — it was meant to protect
_existing vault notes and OAuth/MCP connectivity_, not this specific access-control gap. See §13 for the
decision this requires before Gate 1.

---

## 8. Backup/rollback and audit (resolves GAP-009)

- **Soft-delete exists:** `trash()` moves a file's record to `trash/<id>` before delete; `restoreTrash()`
  reverses it. This is used automatically on overwrite for `move`, `copy`, `restoreTrash`, and
  `importBinary`. This is a genuinely useful primitive for Gate 2's "backup before bulk apply"
  requirement — extend it, don't replace it.
- **No audit log exists.** There is no append-only record of who changed what, when. `AuditRepository`
  (Gate 2/3) is entirely new work, not an extension of something present.
- **No pre-bulk snapshot mechanism** beyond per-file trash. `desk_ingest_workflow_dashboard` does write
  immutable `history/` snapshots for its own state (per `SECURITY.md`'s "Workflow dashboard safeguards"
  section) — that pattern (append a timestamped snapshot on every state-changing write) is a good
  template for the new `AuditRepository` and for `apply_decomposition`'s backup step.

## 9. Test/CI status (resolves GAP-010)

`vitest run` — 7 test files (`vault`, `viewer`, `auth`, `mcp-server`, `workflows`, `workflow-dashboard`,
`dashboard`), 23 passing tests as of 1.6.0 per `CHANGELOG.md`. Coverage is solid for the logic that
exists (path safety, concurrency conflicts, markdown escaping, dashboard signature validation) but,
structurally, **there are no tests for authorization** — because there is currently nothing to test.
Gate 0/1 acceptance criteria (`docs/11_ACCEPTANCE_TESTS.md` → Security section: "unauthenticated write
fails") **will fail against the current build** until §13 is resolved. Flag this explicitly rather than
silently weakening that acceptance test.

---

## 10. Differences from the handoff's assumptions

| Handoff assumption / doc                                                                                     | Reality                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `current-runtime-map.json`: `"Admin auth": "present"` (via original black-box audit)                         | Present as _code paths_, but both are hardcoded no-ops. Functionally: absent.                                                                                                               |
| `docs/13...`: GAP-006 "Admin session details unknown"                                                        | Resolved: no session, no cookie check, no password check.                                                                                                                                   |
| `docs/09_SECURITY_AND_GOVERNANCE.md`: "Do not assume admin authentication is sufficient for all MCP clients" | Correct instinct, but the real gap is broader: admin authentication isn't sufficient for _anything_, including the web/admin surface itself, because it doesn't exist.                      |
| `contracts/mcp-tools.yaml` tool names (`desk_os_*`)                                                          | No overlap with the 19 tools actually registered. Additive, not a rename (see §3).                                                                                                          |
| `docs/04_TARGET_ARCHITECTURE.md` frontend fallback ("Vite/React only if nothing maintainable exists")        | Applies as written — current frontend is a single static HTML file with inline JS, not a framework.                                                                                         |
| Gate 0 acceptance: "current health/OAuth/MCP/vault smoke tests pass... no behavior change"                   | Still correct for OAuth/MCP/vault-read behavior. Needs one explicit exception carved out for the access-control decision in §13, or Gate 1 will silently inherit an open-write PM database. |

---

## 11. Consolidated risk list (from source-level security review, exclusive of the auth gap above)

These are real, independent of whichever access-control option is chosen in §13 — fix regardless:

1. **ReDoS in `obsidian_search_notes` / `vault.search()`** — user-supplied regex runs against up to
   2,000 note bodies with no time budget. A pathological pattern can hang a function invocation.
2. **`allRecords()` sequential fan-out** — see §4. Fix before layering PM reads on top.
3. **Zip-bomb intermediate allocation in `vault-import.mts`** — `unzipSync` fully inflates before
   per-file/per-total size checks run. Prefer a streaming unzip or pre-check the central directory.
4. **Download endpoint trusts stored `mimeType`** — currently neutralized by `Content-Disposition:
attachment` + `nosniff`, but one change away from stored-content-type XSS. Consider forcing
   `application/octet-stream` for non-allowlisted types outright.
5. **Root `netlify.toml` CSP allows `script-src 'unsafe-inline'`** — needed today for `public/index.html`'s
   inline script. The new React frontend should ship without inline scripts so this can be tightened.
6. **`safeError()` leaks raw `Error.message` to clients** — fine for `VaultProblem`, not fine for
   unexpected exceptions (parser internals, blob-store errors). Return a generic message; log detail
   server-side only.
7. **Dead code: `BlobVaultService.deleteAllActiveFiles()`** — full-vault wipe, no caller anywhere in the
   codebase. Remove it, or gate it behind the new admin-auth boundary with explicit confirmation.

---

## 12. Proposed file-change plan (Gates 1–4, mapped to real paths)

```text
Gate 1 — Domain (new, pure TS, no imports from src/lib or netlify/functions)
  src/domain/
    entities.ts            # Workspace/Project/Deliverable/Sprint/Task/Step/Evidence/Decision/Proposal
    ids.ts                 # prj_/spr_/tsk_/evd_/dec_/prop_/aud_ opaque ID generation
    transitions.ts         # status-transition guards per docs/03_CAPABILITY_MAP.md lifecycles
    validation.ts          # zod schemas mirroring contracts/domain-model.yaml
    capacity.ts            # WIP/one-dominant-delivery/max-3-steps checks
  tests/domain/*.test.ts

Gate 2 — Repository (adapters over the EXISTING BlobVaultService, not a new store)
  src/repository/
    interfaces.ts          # ProjectRepository, SprintRepository, TaskRepository, ContextRepository,
                            # EvidenceRepository, ProposalRepository, AuditRepository
    vault-adapter.ts        # implements interfaces using vault.putBytes/getRecord/allRecords under
                            # a `_desk-os/state/**` prefix (see §4 on ALWAYS_PROTECTED)
    index-manifest.ts       # fixes the allRecords() fan-out (§4/§11.2) — maintained per-type index
  src/lib/vault.mts          # PATCH: allow `_desk-os` (or chosen prefix) through normalizeVaultPath
                              #        without weakening .obsidian/.git/hidden-path protection
  tests/repository/*.test.ts

Gate 3 — Application services (shared by MCP + HTTP)
  src/application/
    project-service.ts, sprint-service.ts, board-service.ts, today-service.ts,
    context-service.ts, evidence-service.ts, decomposition-service.ts, audit-service.ts

Gate 4 — MCP adapter (ADDITIVE — do not touch the 19 existing tools)
  src/mcp-server.mts        # add new desk_os_* registrations alongside existing obsidian_*/desk_*
  src/mcp/desk-os-tools.ts  # new file: tool definitions calling application services only

Gate 0.5 (NEW — see §13, insert before Gate 1 proper)
  src/lib/auth.mts          # replace verifyAdminRequest()/verifyAdminPassword() no-ops with a real
                              # check per the chosen option in §13
  netlify/functions/admin-login.mts / admin-logout.mts   # real session issuance/clearing
  netlify/functions/vault-*.mts, workflow-dashboard.mts  # call verifyAdminRequest() and enforce it
  tests/auth.test.ts        # extend: unauthenticated write → 401/403 (currently would fail — see §9)
```

---

## 13. Decision required before Gate 1: access control on the HTTP surface

Gate 0's instruction is "no behavior change." Taken literally, that means shipping a PM system whose
Projects/Sprints/Tasks/Evidence are publicly readable and writable by anyone with the URL — which
`SECURITY.md` itself already warns against for exactly this kind of data. This needs Leonardo's explicit
call, not an assumption baked in silently. Three options, ranked by effort:

**Option A — Keep fully open.** Zero changes to `auth.mts`. Fastest, but contradicts `AGENTS.md` rule 7
("every write operation must be authenticated") and `SECURITY.md`'s own warning once real project data
lives here. Not recommended once this stops being a personal notes vault.

**Option B — Single shared-secret gate on the HTTP/admin surface (recommended minimum for MVP).**
Reintroduce one operator-level check: a real password (new `ADMIN_PASSWORD`-equivalent env var,
compared with `crypto.timingSafeEqual`, never returned to the client) issuing a signed, `HttpOnly`,
`Secure`, `SameSite=Lax` session cookie via `admin-login`/`admin-logout` (both already exist as
endpoints — just need real bodies). `verifyAdminRequest()` checks that cookie. Leaves MCP/OAuth exactly
as-is (already has its own, separate, adequate gate per §5). Low effort, closes the actual gap, matches
what 1.3.0 already did before 1.4.0 removed it — this is closer to "restoring" than "designing new."

**Option C — Full per-actor authorization** (real user accounts/roles). Correct long-term, explicitly
out of MVP scope per `docs/02_PRODUCT_VISION_AND_SCOPE.md` ("single-user workspace" is the MVP boundary;
multi-user is "Later"). Do not build this now.

**Recommendation: Option B**, scoped as the new "Gate 0.5" in §12, completed _before_ any PM domain data
is written through these routes. This satisfies `AGENTS.md` rule 7 without expanding scope beyond what
the handoff already calls for.

---

## 14. Immediate next commands for Claude Code (Gate 0 verification)

```bash
npm install
npm run build        # tsc --noEmit
npm test              # vitest run — expect 7 files / 23 passing tests
npm run test:smoke    # scripts/smoke-oauth.mjs
npx netlify link       # confirm/attach to desk-os-vault-mcp-openai if not already linked
npx netlify dev        # local server; smoke-test /health, /mcp discovery, /api/vault/status
```

Do not run `netlify deploy --prod` at any point in this cycle. Confirm each command's actual output
against this document before proceeding to Gate 1 — if anything here doesn't match what you observe
(dependency versions, test counts, tool names), stop and report the discrepancy rather than silently
reconciling it, per `AGENTS.md` rule 15 ("treat all unverified assumptions as GAP, not fact").

---

## 15. Explicit statement

No production system was accessed, modified, or deployed to produce this document. All findings above
come from static review of the provided source archive and the black-box audit already included in
`references/README_CURRENT_MCP_AUDIT.md`. Production approval remains required per DEC-009 and the
Deploy Gates in `plans/DEPLOY_GATES.md` before any release, unchanged by anything in this document.
