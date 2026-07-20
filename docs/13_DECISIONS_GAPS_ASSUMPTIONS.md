# 13 — Decisions, Gaps and Assumptions

## Binding decisions

| ID | Decision |
|---|---|
| DEC-001 | One shared domain core; MCP and web are adapters. |
| DEC-002 | Preserve current OAuth, JWT and vault behavior before refactoring. |
| DEC-003 | Vault remains the context and note system in MVP. |
| DEC-004 | Operational state uses a repository abstraction and one canonical representation. |
| DEC-005 | Existing storage adapter is preferred after source inspection; no database introduced by assumption. |
| DEC-006 | Claude Skill remains the adaptive reasoning layer in MVP. |
| DEC-007 | MCP validates and persists decomposition proposals; application requires explicit approval. |
| DEC-008 | The frontend is not a Linear clone; it implements DESK-OS core flows. |
| DEC-009 | No production deployment without Leonardo's explicit approval. |
| DEC-010 | One dominant daily delivery, one active workflow default and up to three steps are product defaults. |

## Gaps

| ID | Gap | Required resolution |
|---|---|---|
| GAP-001 | Source code not available through Netlify connector | inspect local/source ZIP |
| GAP-002 | Current persistence unknown | trace vault repository implementation |
| GAP-003 | Current MCP tools unknown | inventory server registration |
| GAP-004 | Current frontend framework unknown | inspect source |
| GAP-005 | OAuth security details unknown | code review and tests |
| GAP-006 | Admin session details unknown | code review and tests |
| GAP-007 | `obsidian` env variable purpose unknown | inspect references |
| GAP-008 | Existing data schema unknown | export and sample analysis |
| GAP-009 | Backup/rollback unknown | implement/document |
| GAP-010 | Current CI/test coverage unknown | inventory and establish baseline |

## Assumptions to validate

- single-user MVP is sufficient;
- current vault data can support stable entity references;
- current Netlify Functions architecture can host the new services;
- the current UI can be incrementally extended;
- Claude Skill can reliably output the proposed decomposition schema;
- a five-day sprint is the correct default for the initial workflow.

Do not convert an assumption into architecture without recording evidence.
