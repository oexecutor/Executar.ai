# 10 — Implementation Plan

## Gate 0 — Baseline and recovery

Deliverables:

- source recovered locally;
- Git repository initialized or existing repo confirmed;
- `.gitignore`;
- baseline commit;
- actual architecture inventory;
- route and tool inventory;
- current build command;
- current tests;
- `docs/IMPLEMENTATION_BASELINE.md`;
- no behavior change.

Acceptance:

- current service builds locally;
- current health/OAuth/MCP/vault smoke tests pass;
- production has not changed.

## Gate 1 — Domain and schemas

Deliverables:

- pure TypeScript domain package/module;
- entity types;
- runtime schemas;
- status transition rules;
- ID generation;
- concurrency versioning;
- unit tests.

Acceptance:

- domain imports no Netlify/MCP/UI code;
- invalid transitions fail;
- task step count > 3 fails;
- evidence taxonomy validates.

## Gate 2 — Repository abstraction

Deliverables:

- repository interfaces;
- adapter for actual current vault persistence;
- backup support;
- audit repository;
- deterministic indexes;
- migration utility that does not alter existing notes by default.

Acceptance:

- read/write round trip;
- concurrent version conflict detected;
- duplicate idempotency key does not duplicate records;
- export remains compatible.

## Gate 3 — Application services

Deliverables:

- project service;
- sprint service;
- task/board service;
- today service;
- context/evidence service;
- decomposition proposal service;
- unit and integration tests.

Acceptance:

- same services callable from HTTP and MCP;
- no business rule duplicated in adapters.

## Gate 4 — MCP tools

Deliverables:

- tool catalog implemented;
- structured schemas;
- annotations;
- typed errors;
- audit IDs;
- compatibility with current MCP endpoint and OAuth.

Acceptance:

- read tools do not mutate;
- writes require auth;
- apply requires explicit approval;
- tool tests pass against local MCP transport.

## Gate 5 — HTTP API and frontend

Deliverables:

- API routes;
- Today;
- Projects;
- Project detail;
- Sprint/Kanban;
- Capture;
- Proposal review;
- Search;
- responsive and accessible states.

Acceptance:

- move card persists;
- page refresh retains state;
- Claude/MCP change appears in UI;
- UI change appears through MCP read;
- keyboard board interaction works;
- mobile has no required horizontal scrolling.

## Gate 6 — Quality, preview and handoff

Deliverables:

- lint;
- TypeScript check;
- unit tests;
- integration tests;
- E2E;
- accessibility check;
- security smoke tests;
- `.env.example`;
- deploy preview;
- rollback runbook;
- release notes.

Acceptance:

- all required checks pass;
- preview reviewed;
- production unchanged until explicit approval.

## Gate 7 — Production release

Requires Leonardo's explicit approval.

Steps:

1. backup production vault/state;
2. verify production variables;
3. merge approved commit;
4. deploy;
5. run post-deploy smoke tests;
6. verify MCP connection;
7. verify Today and Board;
8. record deploy ID;
9. retain rollback artifact.
