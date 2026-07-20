# 03 — Capability Map

## Delivery levels

| Capability | MVP | V1 | Later |
|---|---:|---:|---:|
| Projects | yes | enhance | enhance |
| Sprints | yes | enhance | enhance |
| Kanban | yes | enhance | enhance |
| Today view | yes | enhance | enhance |
| Task steps ≤ 3 | yes | maintain | maintain |
| Vault note linking | yes | enhance | enhance |
| Evidence/decisions | yes | enhance | enhance |
| Decomposition workflow | yes | enhance | server runner |
| Import/export | preserve | enhance | enhance |
| Search | basic | full text | semantic |
| Saved filters | basic | yes | yes |
| Dependencies | basic | yes | yes |
| Templates | one | multiple | marketplace |
| Print A4 | basic | polished | physical integration |
| QR contextual | no change | integrate | expand |
| Multi-user | no | optional | yes |
| Notifications | no | minimal | configurable |
| Analytics | audit only | product metrics | portfolio analytics |

## Project lifecycle

```text
IDEA
→ PLANNED
→ ACTIVE
→ ON_HOLD
→ COMPLETED
→ ARCHIVED
```

## Sprint lifecycle

```text
DRAFT
→ PLANNED
→ ACTIVE
→ REVIEW
→ COMPLETED

Any non-completed state may move to CANCELLED with reason.
```

## Task lifecycle

```text
BACKLOG
→ READY
→ IN_PROGRESS
→ DONE

READY or IN_PROGRESS → BLOCKED
BLOCKED → READY or IN_PROGRESS
Any open state → CANCELLED
```

## Default personal operating constraints

```yaml
week_days: [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]
max_active_workflows: 1
max_daily_dominant_deliveries: 1
max_steps_per_task: 3
default_sprint_days: 5
default_kanban_columns:
  - BACKLOG
  - READY
  - IN_PROGRESS
  - BLOCKED
  - DONE
```

These are defaults, not hard-coded universal medical rules.
