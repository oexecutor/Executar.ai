# 14 — Traceability Matrix

| User need | Product capability | Domain/service | MCP tool | UI |
|---|---|---|---|---|
| See what to do now | Today view | TodayService | `desk_os_get_today` | Today |
| Manage project | Project CRUD | ProjectService | create/update/get/list project | Projects |
| Plan week | Sprint | SprintService | create/update/get current sprint | Sprint |
| Move work | Ordered task status | BoardService | move task | Kanban |
| Use notes as context | Context links/search | ContextService | search context | Capture/Search |
| Decompose project | Proposal workflow | DecompositionService | prepare/apply decomposition | Proposal review |
| Know why a plan exists | Evidence and decisions | EvidenceService | add evidence | Evidence panel |
| Resume work | Stable context + next action | Project/Today services | get project/today | Today/Project |
| Avoid accidental mass change | Proposal/approval | DecompositionService | apply with approval | Approve screen |
| Preserve history | Audit and backup | AuditRepository | returned audit IDs | History |
| Continue Obsidian use | Vault adapter | ContextRepository | search/link context | Linked notes |
| Use Claude | MCP adapter | all services | typed tools | external |
