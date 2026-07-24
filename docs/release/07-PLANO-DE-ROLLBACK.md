# 07 — Plano de Rollback

## Como identificar um incidente

- Erros 5xx sustentados em rotas antes saudáveis (`/api/auth/me`,
  `/api/executar/*`, `/mcp`, `/health`) — ver o padrão exato já documentado
  em `DIAGNOSTICO-HOTFIX.md` (`request.headers.get is not a function`,
  avisos de "default export returned a Response").
- Falha de build/deploy no painel Vercel.
- Queda de disponibilidade do `/health` (rota pública, sem autenticação,
  deve sempre responder).
- Relato de usuário de dados de outro workspace aparecendo no próprio (dado
  o risco RISK-001 do workspace público).

## Como interromper o rollout

- No painel Vercel: promover manualmente o deployment de produção anterior
  conhecido-bom (rollback nativo da Vercel, sem precisar de novo build).
- Se o incidente for de código já mesclado em `main`: `git revert` do commit
  problemático (nunca `git reset --hard` em `main`) e novo deploy.

## Como voltar ao deployment anterior

1. Painel Vercel → projeto `executar-ai` → Deployments → localizar o último
   deployment estável anterior → "Promote to Production".
2. Confirmar via `curl -i https://executar-ai.vercel.app/health` que a
   resposta voltou ao normal.
3. Rodar o checklist de `README-HOTFIX.md` (`/api/auth/me`,
   `/api/executar/projects`, `/mcp`) para confirmar que as rotas críticas
   respondem sem 500.

## Como preservar dados

- Rollback de **código** (deployment) não afeta dados já persistidos em
  Neon/Supabase — o rollback é só da camada de aplicação.
- Antes de qualquer operação destrutiva em dados (ex.: migração de schema),
  seguir a regra já estabelecida em `docs/09_SECURITY_AND_GOVERNANCE.md`:
  "backups before bulk/destructive changes".
- Se o incidente for de corrupção de dados (não só de código), o rollback de
  deployment sozinho não resolve — precisa de restauração de backup do
  banco (Neon/Supabase), fora do escopo deste plano até `DECISÃO NECESSÁRIA
  #2` definir qual é o backend único de produção.

## Como comunicar

- Aviso direto ao(s) usuário(s) ativo(s) (hoje, operação solo-founder/beta
  fechado — sem canal de comunicação em massa configurado ainda; ver
  `08-OPERACAO-POS-LANCAMENTO.md`).

## Como testar o rollback

- Antes do G9 (lançamento público): executar um rollback de teste contra um
  preview deployment (nunca produção), confirmando que o processo de
  "Promote to Production" funciona como esperado e que o tempo de reversão é
  aceitável.

## Quem decide

- Rollback de código: dono do produto ou, sob autorização prévia registrada,
  execução assistida (Claude Code) — nunca sem que o dono do produto seja
  notificado.
- Rollback/restauração de dados: sempre o dono do produto, dado o risco de
  perda de dados de usuários reais uma vez que existam.
