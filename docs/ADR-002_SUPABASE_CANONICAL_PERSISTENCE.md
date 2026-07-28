# ADR-002 — Supabase como persistência canônica (DEC-002)

Status: aceito, implementação em duas fases.

## Contexto

`ADR-001` já havia estabelecido "Supabase Postgres, Auth e RLS como base
multiusuário", mas `src/lib/stores.ts` manteve uma bifurcação real:

- **Vault**: usa `SupabaseKvStore` apenas quando `supabaseConfigured()` é
  verdadeiro **e** um `workspaceId` é fornecido; caso contrário, cai em
  `PostgresKvStore` (Vercel Postgres/Neon).
- **OAuth** (registro de clientes/tokens do `/mcp`): sempre
  `OAuthPostgresStore`, sempre Vercel Postgres/Neon, independente de
  configuração do Supabase.

Isso criava ambiguidade real sobre qual backend é fonte de verdade (`RISK-002`
em `docs/release/04-RISCOS-DECISOES.md`), e o dono do produto aprovou
explicitamente, em 2026-07-28, resolver essa ambiguidade em favor do Supabase.

## Decisão

Supabase Postgres é o backend de persistência canônico para o EXECUTA.AI.
Vercel Postgres/Neon deixa de ser o padrão para dados novos.

### Fase 1 — já em vigor (nenhuma migração de dados necessária)

Com autenticação real habilitada por padrão (`DEC-001`), toda requisição
autenticada carrega um `workspaceId` real. Isso significa que `vaultStore()`
já usa `SupabaseKvStore` para praticamente todo tráfego autenticado quando
Supabase está configurado — a bifurcação em `stores.ts` permanece no código
como rede de segurança (ambiente sem Supabase configurado, ou chamada sem
escopo de workspace), não mais como caminho principal ambíguo.

**Nenhuma mudança de código foi necessária para esta fase** — é consequência
direta de DEC-001. Verificado por leitura de `src/lib/stores.ts` e pela
suíte de testes existente (`npm test`, verde).

### Fase 2 — pendente, escopo próprio (não executada nesta sessão)

Migrar o registro OAuth (`oauthStore()`, hoje sempre
`OAuthPostgresStore`/Neon) para Supabase. Isso é trabalho novo, não uma
troca de flag:

1. desenhar o schema de clientes/tokens OAuth em `supabase/migrations/`,
   com RLS restrita a service role (mesmo padrão de
   `supabase/migrations/202607230001_phase4_workspace_rls.sql`);
2. implementar um `SupabaseOAuthStore` compatível com a interface `KvStore`
   usada por `OAuthPostgresStore` hoje;
3. escrever migração de dados testada (exportar clientes/tokens ativos do
   Neon, importar no Supabase, validar paridade linha a linha);
4. plano de rollback explícito (manter `OAuthPostgresStore` disponível e
   reversível por variável de ambiente até a migração ser homologada em
   produção);
5. só então trocar `oauthStore()` para o novo backend.

**Por que isso não foi feito nesta sessão**: é uma migração de dados reais
(registros de cliente OAuth e tokens usados pela integração MCP em produção,
incluindo a própria sessão que edita este repositório). Esta sessão não tem
acesso de rede à produção para executar ou verificar uma migração ao vivo —
tentar migrar às cegas arriscaria quebrar a autenticação MCP sem capacidade
de detectar ou reverter o problema. Fica registrado como próxima ação
concreta, não como decisão pendente.

## Consequências

- Vault: comportamento já correto, sem ambiguidade prática para tráfego
  autenticado.
- OAuth: continua em Vercel Postgres/Neon até a Fase 2, com essa decisão
  registrada e não mais tratada como drift acidental.
- `RISK-002` é reclassificado: mitigado para Vault, aberto e escopado para
  OAuth (ver backlog `EXA-G3-DATA-002`).

## Alternativas rejeitadas

- migrar o registro OAuth imediatamente, sem verificação em produção —
  rejeitado por risco de quebrar autenticação MCP sem rede de segurança;
- manter a ambiguidade Neon/Supabase sem decisão registrada — rejeitado,
  era exatamente o `RISK-002` original;
- reverter Vault para Vercel Postgres/Neon como canônico — rejeitado,
  contradiz `ADR-001` e a arquitetura já mais madura (RLS, workspaces) do
  lado Supabase.
