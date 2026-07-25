# EXECUTA.AI — Status operacional do MCP

**Data:** 2026-07-25  
**Estado:** HOMOLOGADO  
**Fonte canônica:** `https://executar-ai.vercel.app/mcp`

## Resumo executivo

O MCP remoto do EXECUTA.AI foi homologado de ponta a ponta no Claude. O fluxo de descoberta OAuth, registro dinâmico do cliente, autorização, emissão de token e conexão final foi concluído com sucesso.

## Arquitetura ativa

- Aplicação: `https://executar-ai.vercel.app/app`
- Dashboard: `https://executar-ai.vercel.app/dashboard`
- MCP canônico: `https://executar-ai.vercel.app/mcp`
- Vault/API: `https://executar-ai.vercel.app/api/vault/*`
- Repositório: `oexecutor/Executar.ai`
- Projeto Vercel: `executar-ai`

## Problemas identificados e corrigidos

1. OAuth dependia de `SUPABASE_SERVICE_ROLE_KEY`, embora o produto estivesse operando em modo workspace público.
2. OAuth e `/mcp` utilizavam regras distintas de autorização.
3. `/api/auth/config` retornava falso `503 AUTH_NOT_CONFIGURED` no modo público.
4. `MCP_JWT_SECRET` existia na Vercel, mas o valor salvo tinha menos de 32 caracteres.
5. O deployment precisava ser recriado para receber a nova configuração de ambiente.

## Correções aplicadas

- resolvedor único de autorização para OAuth e MCP;
- modo público restrito à identidade canônica `public/public`;
- validação Supabase preservada quando o modo privado estiver configurado;
- `/api/auth/config` retorna `200` com `mode: public`;
- `MCP_JWT_SECRET` atualizado na Vercel para Production e Preview;
- redeploy de produção concluído;
- proteção de build criada para bloquear novos deployments com segredo JWT ausente ou curto.

## Evidências

- PR #18 — OAuth no workspace público: https://github.com/oexecutor/Executar.ai/pull/18
- PR #20 — modo público explícito: https://github.com/oexecutor/Executar.ai/pull/20
- PR #22 — proteção de build para o segredo JWT: https://github.com/oexecutor/Executar.ai/pull/22
- Deployment homologado após atualização do segredo: `dpl_FxXpaFZweWZFP3ZJhumd4XVQ7MWe`
- Linear: `FUN-69`

## Homologação final

- OAuth protected-resource discovery: aprovado;
- OAuth authorization-server discovery: aprovado;
- Dynamic Client Registration: aprovado;
- autorização do Claude: aprovada;
- emissão de access token: aprovada;
- conexão do Claude: aprovada pelo usuário;
- MCP disponível para uso operacional.

## Modo atual

O produto opera em `workspace public`:

- `workspaceId`: `public`;
- `workspaceName`: `Workspace público`;
- login individual Supabase não é obrigatório nesta fase;
- usuários e workspaces privados ainda não estão ativados.

## Uso recomendado

No Claude, utilizar o conector associado a:

`https://executar-ai.vercel.app/mcp`

Primeiro comando recomendado:

> Use o Executar-link para listar as ferramentas disponíveis e, depois, listar os arquivos do Vault sem modificar nada.

## Limites e pendências

- ativar usuários e workspaces privados em fase futura;
- concluir e mesclar a proteção de build do PR #22 quando aplicável;
- manter o MCP standalone `executar-mcp-server-vercel-ready` fora do fluxo canônico até sua recuperação e inventário.

## Decisão

**MCP CANÔNICO HOMOLOGADO E OPERACIONAL NO CLAUDE.**
