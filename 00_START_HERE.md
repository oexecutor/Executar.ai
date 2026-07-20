# Start Here

## What Leonardo has today

The production Netlify project `desk-os-vault-mcp-openai` is a remote serverless MCP connected to an Obsidian-style vault.

Confirmed runtime capabilities:

- MCP endpoint at `/mcp`;
- OAuth discovery, client registration, authorization and token endpoints;
- JWT protection;
- separate admin login/logout;
- vault status, files, import and export;
- human view at `/view`;
- workflow dashboard at `/dashboard`;
- Node.js 20 Netlify Functions;
- 14 deployed functions;
- manual API/drop deployment;
- no linked Git repository, branch or commit visible in Netlify.

## What Leonardo wants

A project-management operating system where:

1. notes, ideas and evidence continue to live in the vault;
2. Claude structures these materials into projects, sprints and tasks;
3. the same data appears in a web Sprint/Kanban frontend;
4. moving or completing a card updates the canonical state;
5. Claude can read and update that state through MCP tools;
6. the operational decomposition workflow can be reused without manually formatting work for Linear;
7. the interface reduces cognitive load and always exposes the next action.

## The product is not

- a full clone of Linear;
- a chat-only interface;
- a second database disconnected from the vault;
- a monolithic MCP function containing UI, storage and business logic;
- a system that publishes or mutates critical data without approval;
- a clinical or diagnostic tool.

## Mandatory first action for Claude Code

Before changing code:

1. inspect the real repository/source package;
2. inventory the directory tree, package manager, framework and function style;
3. map every current route and MCP tool;
4. identify the current persistence mechanism;
5. run the current build and tests;
6. create a baseline commit;
7. write `docs/IMPLEMENTATION_BASELINE.md`;
8. reconcile actual code with this handoff;
9. stop and report any contradiction that could cause data loss or auth breakage.

Do not rewrite OAuth, vault storage or the MCP transport from scratch merely because the current structure differs from the proposed structure.
