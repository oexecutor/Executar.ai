# EXECUTA.AI

PWA multiusuário para transformar contexto em execução verificável. O produto reúne:

- motor canônico de projetos com 3 fases, 9 áreas, 36 itens e 81 ações;
- portfólio, Hoje, projeto em Plano/Lista/Tabela, Kanban e documentos;
- autenticação Supabase, memberships e isolamento por workspace;
- APIs HTTP e MCP operando sobre o mesmo estado;
- vault de documentos, evidências, importação e exportação;
- landing pública e workspace autenticado com a identidade EXECUTA.AI.

## Estado

A Fase 4 entrega a fundação funcional em uma branch de Preview. Ela não autoriza publicação em produção. A promoção só pode ocorrer depois de:

1. aplicar e validar a migração Supabase;
2. configurar os secrets do Preview;
3. executar a suíte completa e a homologação humana;
4. registrar a aprovação de lançamento.

Consulte [docs/PHASE_4_IMPLEMENTATION.md](docs/PHASE_4_IMPLEMENTATION.md) e [docs/PARITY_MATRIX_PHASE_4.md](docs/PARITY_MATRIX_PHASE_4.md).

## Arquitetura

```text
Cloud / agente ── OAuth + MCP ─┐
                              ├── API e serviços EXECUTA ── Supabase Postgres + RLS
PWA / usuário ── Supabase Auth ┘                    └────── Vault e evidências
```

O motor, a API, o MCP e o front-end compartilham o mesmo contrato de projeto e o mesmo `workspace_id`. A API de compatibilidade `/api/pm/*` permanece disponível durante a migração incremental.

## Identidade visual

A fonte visual de autoridade é a identidade EXECUTA.AI: fundo cinza, acento laranja, preto e branco. O Forge Visual Canvas orienta composição, hierarquia, responsividade e qualidade SaaS. Tokens CSS são derivados dessa combinação e são uma implementação versionada, não a fonte única de verdade.

## Desenvolvimento

Requisitos: Node.js 20 ou superior e um projeto Supabase.

```bash
npm ci
npm --prefix web ci
cp .env.example .env.local
npm run build
npm test
npm run lint
npm --prefix web run build
npm --prefix web test
npm --prefix web run lint
```

Para desenvolvimento integrado com as Vercel Functions:

```bash
npx vercel dev
```

## Supabase

A migração inicial está em:

```text
supabase/migrations/202607230001_phase4_workspace_rls.sql
```

Ela cria:

- `workspaces`;
- `workspace_memberships`;
- `kv_store` escopado por workspace;
- `oauth_kv_store` separado e acessível apenas pelo servidor;
- funções de autorização;
- políticas RLS para leitura de membros e escrita de `OWNER`, `ADMIN` e `EDITOR`;
- workspace pessoal automático no cadastro.

Aplicação controlada:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase test db
```

Nunca aplique a migração diretamente em produção sem backup, ensaio e aceite.
Se existir um `kv_store` legado sem `workspace_id`, a migração o preserva como
`legacy_kv_store`; o conteúdo operacional deverá ser associado a um workspace
por um procedimento de migração de dados aprovado.

## Variáveis

Use `.env.example` como referência:

- `PUBLIC_BASE_URL`;
- `MCP_JWT_SECRET`;
- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY` somente no servidor;
- `DATABASE_URL` para o registro OAuth durante a migração.

Nenhuma chave de IA ou `service_role` deve usar prefixo `VITE_` ou chegar ao navegador.

## Contratos expostos

- aplicação: `/app`;
- login: `/entrar`;
- API canônica: `/api/executar/*`;
- API de compatibilidade: `/api/pm/*`;
- vault: `/api/vault/*`;
- MCP: `/mcp`;
- OAuth: `/oauth/*`;
- metadados OAuth: `/.well-known/*`.

As 11 ferramentas `executar_*` cobrem validação, criação, leitura, status, próximas tarefas, ações, checkpoints, exportação, reset e exclusão. Ferramentas destrutivas exigem confirmação explícita.

## Publicação

O fluxo oficial é:

```text
branch → pull request → Vercel Preview → migração/configuração Preview
→ testes → homologação → aprovação humana → produção
```

Rollback antes da produção consiste em fechar o PR e remover o Preview. Depois da promoção, reverta o commit de release e restaure o backup do banco conforme o runbook de lançamento.
