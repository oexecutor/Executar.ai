# MVP Backlog

## EPIC-00 — Baseline and safety

- PM-001 Recover source and initialize/confirm Git.
- PM-002 Inventory routes, functions, MCP tools and storage.
- PM-003 Add baseline smoke tests.
- PM-004 Add `.env.example` and secret checks.
- PM-005 Document rollback and current deploy ID.

## EPIC-01 — Domain

- PM-101 Implement IDs and entity schemas.
- PM-102 Implement project transitions.
- PM-103 Implement sprint transitions.
- PM-104 Implement task transitions and max three steps.
- PM-105 Implement dependency-cycle validation.
- PM-106 Implement epistemic records.
- PM-107 Unit tests.

## EPIC-02 — Persistence

- PM-201 Define repository interfaces.
- PM-202 Implement existing-vault adapter.
- PM-203 Implement optimistic concurrency.
- PM-204 Implement idempotency registry.
- PM-205 Implement audit events.
- PM-206 Implement backup before bulk apply.
- PM-207 Implement deterministic indexes.
- PM-208 Integration tests.

## EPIC-03 — Application services and MCP

- PM-301 Project service and tools.
- PM-302 Sprint service and tools.
- PM-303 Board/task service and tools.
- PM-304 Today service/tool.
- PM-305 Context search/tool.
- PM-306 Evidence service/tool.
- PM-307 Prepare decomposition.
- PM-308 Apply decomposition with approval.
- PM-309 Close sprint.
- PM-310 MCP schema/transport tests.

## EPIC-04 — HTTP API and UI

- PM-401 Shared API error/response layer.
- PM-402 Today screen.
- PM-403 Project list/detail.
- PM-404 Sprint/Kanban.
- PM-405 Capture.
- PM-406 Proposal review.
- PM-407 Search.
- PM-408 Sync/error states.
- PM-409 A4 print summary.
- PM-410 Accessibility and responsive tests.

## EPIC-05 — Release

- PM-501 CI checks.
- PM-502 Deploy Preview.
- PM-503 End-to-end consistency test.
- PM-504 Security smoke test.
- PM-505 Release notes and rollback.
- PM-506 Production only after explicit approval.
