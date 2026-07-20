# 05 — Domain Model

The machine-readable contract is in `contracts/domain-model.yaml`.

## Hierarchy

```text
WORKSPACE
└── PORTFOLIO (optional in MVP UI)
    └── PROJECT
        ├── DELIVERABLE
        ├── SPRINT
        │   └── TASK
        │       └── STEP (maximum 3 visible)
        ├── NOTE LINKS
        ├── EVIDENCE
        ├── DECISIONS
        └── AUDIT EVENTS
```

## Identity

Use opaque stable IDs with readable prefixes:

```text
wsp_
prj_
del_
spr_
tsk_
stp_
evd_
dec_
prop_
aud_
```

IDs must never depend on a title or path.

## Versioning

Every mutable aggregate requires:

- `version`;
- `created_at`;
- `updated_at`;
- optimistic concurrency check;
- actor;
- audit event.

## Definition of done

A task cannot be treated as completed only because its status changed.

It should support:

- expected outcome;
- acceptance criteria;
- completion evidence;
- completion timestamp;
- completion actor.

## Evidence taxonomy

```text
FACT
EVIDENCE
INFERENCE
HYPOTHESIS
COUNTEREVIDENCE
GAP
DECISION
```

## Proposal model

Decomposition output is never applied directly.

```text
DRAFT PROPOSAL
→ VALIDATED PROPOSAL
→ USER APPROVED
→ APPLIED
```

A proposal records:

- source context;
- assumptions;
- gaps;
- capacity analysis;
- project changes;
- sprint changes;
- tasks;
- warnings;
- approval metadata;
- application result.
