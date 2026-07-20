# 06 — MCP Tool Catalog

The canonical machine-readable catalog is `contracts/mcp-tools.yaml`.

## Design rules

- tools call application services;
- read tools never mutate state;
- write tools return an audit ID;
- create/apply tools support idempotency keys;
- bulk or destructive changes require approval;
- tool descriptions explain when not to use them;
- outputs include both concise text and structured content;
- errors are typed and actionable;
- no tool exposes raw secrets or unrestricted file paths.

## MVP read tools

| Tool | Purpose |
|---|---|
| `desk_os_get_system_status` | Check service, repository and vault state |
| `desk_os_search_context` | Search notes, evidence and project context |
| `desk_os_list_projects` | List/filter projects |
| `desk_os_get_project` | Get complete project context |
| `desk_os_get_current_sprint` | Get active sprint |
| `desk_os_get_board` | Get ordered Kanban columns/cards |
| `desk_os_get_today` | Get dominant delivery, steps and commitments |

## MVP write tools

| Tool | Purpose |
|---|---|
| `desk_os_create_project` | Create a project |
| `desk_os_update_project` | Update explicit project fields |
| `desk_os_create_sprint` | Create a sprint |
| `desk_os_update_sprint` | Update sprint metadata/state |
| `desk_os_create_task` | Create a task with up to three steps |
| `desk_os_update_task` | Update task content |
| `desk_os_move_task` | Move/reorder a task |
| `desk_os_add_evidence` | Add fact/evidence/decision/gap record |

## Workflow tools

| Tool | Purpose |
|---|---|
| `desk_os_prepare_decomposition` | Validate and persist a proposed decomposition without applying it |
| `desk_os_apply_decomposition` | Apply an approved proposal atomically |
| `desk_os_close_sprint` | Review and close a sprint with evidence |

## Approval boundary

```text
prepare_decomposition:
  may read and create proposal
  must not create operational tasks

apply_decomposition:
  requires proposal_id
  requires approved_by_user = true
  creates backup
  applies atomically
  returns audit_id and affected IDs
```
