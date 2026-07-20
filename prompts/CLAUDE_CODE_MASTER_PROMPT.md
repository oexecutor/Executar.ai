# Claude Code Master Prompt

Copy this package into the root of the recovered source repository, then give Claude Code the instruction below.

---

You are responsible for evolving the existing production project `desk-os-vault-mcp-openai` into the DESK-OS project-management system specified in this handoff.

Read, in order:

1. `AGENTS.md`
2. `00_START_HERE.md`
3. `docs/01_CURRENT_STATE.md`
4. `docs/02_PRODUCT_VISION_AND_SCOPE.md`
5. `docs/04_TARGET_ARCHITECTURE.md`
6. every file in `contracts/`
7. `docs/10_IMPLEMENTATION_PLAN.md`
8. `docs/11_ACCEPTANCE_TESTS.md`
9. `plans/BACKLOG_MVP.md`
10. `plans/DEPLOY_GATES.md`

## Mission

Preserve the current MCP, OAuth, JWT, admin and vault capabilities while adding a shared project-management domain that can be operated both through MCP tools and a Sprint/Kanban web frontend.

## Critical interpretation

Do not build the full application inside the MCP handler.

Implement:

```text
domain
→ repositories
→ application services
→ MCP adapter
→ HTTP API adapter
→ web UI
```

The same application services must power both MCP and web actions.

## First run — no feature coding yet

1. Inspect the complete repository.
2. Identify package manager, monorepo layout, runtime, framework and test tools.
3. Locate all current Netlify Functions.
4. Locate the MCP server registration, current tools/resources/prompts and transport.
5. Trace OAuth and admin authentication.
6. Trace vault persistence and import/export.
7. Run the current build and tests.
8. Start locally with the correct Netlify-compatible command.
9. Run smoke tests for current routes.
10. Create `docs/IMPLEMENTATION_BASELINE.md` containing:
   - actual directory tree;
   - current architecture;
   - current routes/functions;
   - current MCP catalog;
   - current persistence;
   - current test status;
   - differences from the handoff;
   - risks;
   - exact proposed file-change plan.
11. Create or confirm a baseline Git commit.
12. Do not deploy production.

After the baseline, proceed gate by gate from `docs/10_IMPLEMENTATION_PLAN.md`.

## Implementation constraints

- Preserve existing routes and behavior.
- Prefer incremental refactoring.
- Use pure domain modules without Netlify/MCP/UI dependencies.
- Use repository interfaces.
- Reuse the existing vault persistence when safe.
- Do not introduce Supabase, another database or a framework migration without evidence and an ADR.
- Use TypeScript and modern Netlify Function syntax when compatible with the source.
- Use `Netlify.env` for runtime variables.
- Do not add CORS headers unless required by an identified client flow and documented.
- Add idempotency and optimistic concurrency to writes.
- Every write returns an audit ID.
- Bulk decomposition requires proposal, explicit approval, backup and atomic apply.
- Do not put an AI provider call in the server for MVP. Claude's Skill performs adaptive reasoning; MCP validates/persists.
- Keep one dominant delivery, one active workflow default and no more than three task steps.
- Maintain low-density, keyboard-accessible, reduced-motion UX.
- Never expose production secrets or full private vault content in logs.
- No production deployment without Leonardo Batista's explicit approval.

## Required MVP tools

Implement the catalog in `contracts/mcp-tools.yaml`, adapting naming only when the current MCP SDK imposes a documented constraint.

## Required UI

- Today;
- Projects;
- Project detail;
- Sprint/Kanban;
- Capture;
- Proposal review;
- Search;
- current admin/vault surfaces preserved.

## Required final demonstration

Demonstrate this cross-interface flow locally and in one Deploy Preview:

1. Claude/MCP creates or updates a project.
2. The project appears in the web UI.
3. Claude prepares a decomposition proposal.
4. The proposal appears in the review UI.
5. Approval applies the sprint and tasks.
6. The Kanban displays the cards.
7. Moving a card in the UI persists.
8. MCP reads the new status.
9. Evidence is added and retrieved.
10. Export contains canonical records.
11. Existing vault notes remain intact.

## Required report before any production action

Return:

- baseline findings;
- architecture implemented;
- files changed;
- migrations;
- tests and results;
- preview URL;
- security findings;
- remaining gaps;
- rollback procedure;
- a request for explicit production approval.

Do not run a production deploy while requesting approval.
