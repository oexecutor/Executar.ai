# 15 — Claude Skill ↔ MCP Bridge

## Purpose

Preserve the value of Leonardo's operational decomposition Skill while moving persistence, validation and project operations into the MCP-backed application.

## Responsibility split

### Claude Skill owns

- intent recognition;
- adaptive reasoning;
- project framing;
- interpretation of ambiguous notes;
- epistemic classification;
- decomposition method;
- capacity-aware proposal drafting;
- explanation to Leonardo;
- deciding which MCP tools to call;
- requesting explicit approval.

### Shared application/MCP owns

- canonical schemas;
- IDs;
- authorization;
- current-state reads;
- proposal persistence;
- deterministic validation;
- status transitions;
- concurrency;
- idempotency;
- backups;
- audit trail;
- atomic application;
- frontend consistency.

## Skill instruction to add

```text
When the user requests project decomposition, planning, sprint creation,
project management or task restructuring:

1. Call desk_os_get_project when a project exists.
2. Call desk_os_search_context to recover relevant notes, evidence and decisions.
3. Call desk_os_get_current_sprint to avoid duplicating active work.
4. Apply this Skill's decomposition method.
5. Separate FACT, EVIDENCE, INFERENCE, HYPOTHESIS,
   COUNTEREVIDENCE, GAP and DECISION.
6. Produce tasks with an observable outcome, acceptance criteria
   and no more than three visible steps.
7. Respect one dominant daily delivery and one active workflow by default.
8. Call desk_os_prepare_decomposition.
9. Present the validated proposal and warnings to the user.
10. Do not call desk_os_apply_decomposition without explicit approval.
11. After approval, call desk_os_apply_decomposition using the proposal ID,
    expected version and a stable idempotency key.
12. Read desk_os_get_board and desk_os_get_today to confirm the applied result.
```

## Why not copy the entire Skill into one tool

A tool does not automatically inherit Claude's reasoning instructions. A monolithic server tool would need its own model call or a fully deterministic engine.

For MVP:

```text
Skill = adaptive intelligence
MCP = governed execution
```

For future client independence:

```text
Server workflow runner
+ authorized model provider
+ evaluation suite
+ cost controls
+ explicit ADR
```

Do not add the future runner before the MVP flow is validated.
