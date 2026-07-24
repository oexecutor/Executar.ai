# DIAGNÓSTICO CONFIRMADO — 24/07/2026

## Produção observada

- Projeto Vercel: `executar-ai`
- Produção: `https://executar-ai.vercel.app`
- Commit observado: `5b1a02f9a13edad5efed1bd66c11bedd09daa86f`

## Erros

```text
TypeError: request.headers.get is not a function
```

```text
WARN: default export returned a Response.
The default-export signature is (req, res) => void — returns are ignored.
```

## Rotas afetadas

- `/api/auth/me`
- `/api/auth/config`
- `/api/executar/projects`
- `/mcp`

## Estado da interface

- landing ainda aponta para `/entrar`;
- `/entrar` ainda oferece Google, e-mail e senha;
- `/app` cai no login quando as APIs falham.

## Observação

O redeploy mais recente recompilou o mesmo commit e não corrigiu os erros.
