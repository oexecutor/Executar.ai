# 12 — Deploy Runbook

## Objective

Replace iterative manual production uploads with a controlled local → test → preview → approval → production flow.

## Local

```bash
npm install
netlify link
netlify env:list
netlify dev
```

Use the actual package manager and scripts discovered in source.

## Required scripts

Equivalent commands must exist:

```json
{
  "scripts": {
    "dev": "netlify dev",
    "build": "<actual build>",
    "lint": "<linter>",
    "typecheck": "tsc --noEmit",
    "test": "<unit and integration tests>",
    "test:e2e": "<e2e tests>",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Do not overwrite existing valid scripts without reason.

## Git flow

```text
main
└── feature/project-management-core
    ├── baseline commit
    ├── domain/repository commits
    ├── MCP/API commits
    ├── frontend commits
    └── test/docs commit
```

## Deploy Preview gate

Before preview:

- clean working tree;
- secret scan;
- typecheck;
- tests;
- build;
- migration dry run;
- backup logic test.

Preview validation:

- OAuth metadata;
- MCP connection;
- current vault read;
- project CRUD;
- board move;
- decomposition proposal/apply;
- responsive UI;
- accessibility smoke;
- export;
- no production data mutation.

## Production gate

Do not run `netlify deploy --prod` until Leonardo explicitly approves the reviewed preview.

## Post-deploy checks

- health;
- OAuth;
- MCP;
- admin login;
- vault status;
- list projects;
- current sprint;
- Kanban;
- move one disposable test task or use isolated smoke workspace;
- audit event;
- export;
- logs without secrets.

## Rollback

Record before deployment:

- prior deploy ID;
- backup artifact ID;
- schema/version;
- migration version;
- exact rollback command/process.

Rollback triggers:

- auth regression;
- MCP unavailable;
- data mismatch;
- UI cannot read current vault;
- duplicate task creation;
- security header/cookie failure;
- irrecoverable migration error.
