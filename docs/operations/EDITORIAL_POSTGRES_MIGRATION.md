# Migração Editorial V2 — KV para Postgres relacional

## Registro epistemológico

### FATOS

- A `main` de origem é `7f2bdb49865fec909c9ceca13764bede11b1f27c`.
- O projeto canônico da Vercel é `executar-ai`.
- Em 2026-07-27, produção opera em modo público com `workspace_id=public`.
- A persistência editorial anterior grava um índice e documentos JSON no
  `kv_store`, dentro do namespace do Vault.
- Esse KV já usa Postgres/Neon no projeto canônico; não há Supabase configurado
  no runtime de produção.
- A consulta pública anterior à migração retornou zero publicações editoriais.
- O MCP, OAuth, Vault e os demais domínios continuam usando os adapters atuais.

### LACUNAS

- O conector da Vercel não expõe valores de variáveis; apenas o deployment
  canônico comprova a presença de uma URL de banco válida.
- O modo público não oferece dados de outros workspaces Supabase. Como o
  Supabase não está configurado em produção, não há evidência de workspaces
  Supabase ativos no ambiente canônico.

### RISCOS

- `R1 — schema ausente`: o novo adapter falha fechado; mitigado pela migration
  obrigatória no build do projeto canônico.
- `R2 — perda de rollback`: mitigado por backup relacional do KV, preservação
  integral das linhas de origem e dual-write temporário.
- `R3 — mistura Preview/Production`: mitigado pela coluna `environment` em
  todas as chaves e consultas.
- `R4 — mistura de workspaces`: mitigado por `workspace_id` na chave primária e
  filtro obrigatório do adapter.
- `R5 — Journal bloqueado`: mitigado pelo guard que não exige banco em projetos
  cujo `VERCEL_PROJECT_NAME` não seja `executar-ai`.

## DECISÃO

Aplicar uma migração expand-and-contract no Postgres já configurado:

1. criar `editorial_publications`, `editorial_events`,
   `editorial_legacy_backup` e `app_schema_migrations`;
2. copiar todas as linhas editoriais do KV para a tabela de backup;
3. fazer backfill idempotente de publicações e eventos;
4. usar o adapter relacional como leitura principal;
5. reparar linhas ausentes a partir do KV;
6. manter dual-write no KV por pelo menos um ciclo completo de release;
7. não apagar nem renomear a fonte anterior nesta entrega.

O documento editorial completo permanece em `JSONB` para preservar o contrato
HTTP e de domínio. Identidade, workspace, ambiente, versão, estado, datas e a
relação append-only de eventos são colunas relacionais com constraints.

## Migração versionada

Arquivo:

`supabase/migrations/202607270001_editorial_postgres.sql`

Execução manual controlada:

```bash
npm run db:migrate
```

No projeto Vercel canônico, o build executa a mesma migration antes de compilar.
A migration usa advisory lock e transação, pode ser repetida e registra SHA-256,
contagens de backup, publicações e eventos sem imprimir credenciais ou conteúdo.

## Backup e inventário

Antes da mudança:

- publicações visíveis no workspace público de produção: `0`;
- fonte: `kv_store`;
- exclusões executadas: `0`.

Durante a migration, `editorial_legacy_backup` recebe cópia integral de cada
linha editorial antes do backfill. A origem permanece intacta. A evidência
operacional é a igualdade entre a contagem elegível do KV, o backup e o
backfill, descontadas apenas linhas inválidas que falham nos constraints.

## Rollback

### Rollback de aplicação

1. apontar produção para o deployment anterior;
2. a versão anterior volta a ler o KV;
3. como a release migrada mantém dual-write, mudanças feitas após a promoção
   permanecem disponíveis para a versão anterior;
4. não remover as tabelas relacionais durante o incidente.

### Forward-fix

Se houver divergência:

1. interromper novas escritas editoriais;
2. comparar IDs, `updated_at` e contagens entre KV, backup e Postgres;
3. repetir a migration idempotente;
4. reparar apenas o conjunto divergente;
5. reexecutar o ciclo descartável e os smoke tests;
6. promover um novo Preview validado.

### Contract futuro

A remoção do dual-write e das linhas KV é outra decisão, destrutiva e fora desta
entrega. Exige janela própria, backup exportável e aprovação explícita.

## Gates

- migration em banco vazio;
- backfill sobre KV existente;
- reaplicação idempotente;
- CRUD completo;
- validação e revisão;
- bloqueio de publicação sem aprovação;
- aprovação e publicação;
- solicitação de alteração;
- isolamento entre workspaces e ambientes;
- persistência por nova instância do repository;
- falha segura sem banco/schema;
- deleção com cascade de eventos;
- `/health`, `/app`, `/blog`, API Editorial e `/mcp`;
- CI, Vercel Preview e logs sem erro.
