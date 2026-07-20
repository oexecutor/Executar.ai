# 11 — Acceptance Tests

## Baseline

- `/health` returns success.
- OAuth discovery endpoints return canonical HTTPS URLs.
- existing MCP client can authenticate.
- existing vault files remain readable.
- import/export still work.
- `/view` and `/dashboard` resolve.

## Domain

- project can be created with objective and definition of done.
- sprint dates are coherent.
- task cannot have more than three steps.
- invalid status transition is rejected.
- dependency cycle is rejected.
- entity versions increment on write.
- stale version update returns conflict.

## Board

- cards appear in correct ordered columns.
- drag/drop move persists.
- keyboard move persists.
- duplicate move with same idempotency key does not repeat.
- WIP warning appears when limit is exceeded.
- blocked task requires a reason.

## Today

- returns at most one dominant delivery.
- returns at most three visible steps.
- exposes a next action.
- completed task is not selected as active.
- blocked state is explicit.

## Decomposition

- context is recovered from linked notes.
- output separates fact/evidence/inference/hypothesis/counterevidence/gap/decision.
- proposal does not create tasks.
- apply without approval fails.
- apply with approval creates expected records.
- repeated apply is idempotent.
- partial failure rolls back or reports atomic failure.
- audit event and backup reference exist.

## Cross-interface consistency

1. Claude creates a project through MCP.
2. Project appears in web UI.
3. User moves a task in Kanban.
4. Claude reads the updated status through MCP.
5. User adds evidence in UI.
6. Claude retrieves the evidence.
7. Export includes the canonical records.

## Security

- unauthenticated write fails.
- wrong audience JWT fails.
- invalid redirect URI fails.
- path traversal fails.
- oversized import fails.
- script content is safely rendered.
- admin cookie flags are verified.
- secrets are absent from client bundle and logs.

## Accessibility

- keyboard can reach all primary actions.
- focus is visible.
- board has non-drag alternative.
- reduced motion is honored.
- labels and error messages are announced.
- contrast passes essential checks.
- mobile core flows do not require horizontal scroll.

## Deployment

- `npm run build` passes.
- typecheck passes.
- tests pass.
- preview deploy passes smoke tests.
- rollback command/artifact is documented.
- production change requires explicit recorded approval.
