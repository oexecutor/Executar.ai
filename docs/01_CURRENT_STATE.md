# 01 — Current State

## Confirmed Netlify runtime

| Item | Current state |
|---|---|
| Project | `desk-os-vault-mcp-openai` |
| Production URL | `https://desk-os-vault-mcp-openai.netlify.app` |
| MCP URL | `/mcp` |
| Deployment | API/drop upload |
| Repository | not linked/identified |
| Runtime | Node.js 20 |
| Functions | 14 |
| Edge Functions | none |
| Forms | disabled |
| Framework detection | unknown |
| OAuth | present |
| JWT | present |
| Admin auth | present |
| Vault operations | status, list, import, export |
| Human UI | `/view`, `/dashboard` |

## Confirmed routes

```text
/health
/mcp

/.well-known/oauth-protected-resource
/.well-known/oauth-protected-resource/mcp
/.well-known/oauth-authorization-server

/oauth/register
/oauth/authorize
/oauth/token

/api/admin/login
/api/admin/logout

/api/vault/status
/api/vault/files
/api/vault/import
/api/vault/export

/view
/dashboard
```

## Confirmed environment variable names

- `PUBLIC_BASE_URL`
- `MCP_JWT_SECRET`
- `ADMIN_PASSWORD`
- `obsidian` — purpose/value remains a gap

Never copy production values into source or this handoff.

## Current architectural interpretation

```text
MCP + OAuth + Admin
          ↓
Vault access layer
          ↓
Imported/exported vault content
          ↓
View and workflow dashboard
```

## Gaps that Claude Code must resolve from source

- actual directory structure;
- package manager and dependencies;
- current MCP SDK and transport;
- current MCP tools/resources/prompts;
- HTTP methods and response schemas;
- OAuth implementation quality: PKCE, state, redirect validation, TTL, refresh/revoke;
- admin cookie/session implementation;
- vault persistence mechanism;
- concurrency behavior;
- backup and rollback;
- CORS and security headers;
- test coverage;
- exact `/view` and `/dashboard` frontend implementation;
- source ZIP contents;
- whether Netlify Blobs or another store is already used.

## Existing behavior that must remain compatible

- clients can discover OAuth metadata;
- authorized MCP clients can connect;
- admin can log in and log out;
- vault can be inspected and exported;
- existing imported vault data must not be silently rewritten;
- `/health`, `/view` and `/dashboard` must continue to resolve.
