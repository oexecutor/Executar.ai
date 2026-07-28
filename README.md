# EXECUTA.AI

PWA multiusuário para transformar contexto em execução verificável. O produto reúne:

- motor canônico de projetos com 3 fases, 9 áreas, 36 itens e 81 ações;
- portfólio, Hoje, projeto em Plano/Lista/Tabela, Kanban e documentos;
- autenticação Supabase, memberships e isolamento por workspace;
- APIs HTTP e MCP operando sobre o mesmo estado;
- vault de documentos, evidências, importação e exportação;
- landing pública e workspace autenticado com a identidade EXECUTA.AI.

> [!IMPORTANT]
> ## Auditoria GitHub × Vercel — Gate de lançamento
> **Status atual: CORRIGIR antes do lançamento.**
>
> A auditoria consolidada de repositórios, pull requests, branches e deployments está disponível em:
> **[MASTER INDEX E RELATÓRIO DE AUDITORIA — GITHUB × VERCEL](MASTER_INDEX_AUDITORIA_GITHUB_VERCEL_2026-07-27.md)**.
>
> Prioridades bloqueantes: corrigir o deployment Git-linked do `P2.executar.business`, eliminar a duplicidade de projetos Vercel e migrar o pacote AMES antes de encerrar o PR #4 sem merge.

## Estado

> [!CAUTION]
> **Gate editorial E2 — NO-GO para lançamento.** A publicação não pode avançar ao Preview enquanto DeskGo, Frankwatching e AMES estiverem pendentes ou sem evidência. Consulte o plano obrigatório [DEF-E2-001 — Enriquecimento e validação editorial antes do Preview](docs/editorial-v2/DEF-E2-001-ENRICHMENT-VALIDATION-GATE.md).

A Fase 4 entrega a fundação funcional em uma branch de Preview. Ela não autoriza publicação em produção. A promoção só pode ocorrer depois de:

1. aplicar e validar a migração Supabase;
2. configurar os secrets do Preview;
3. executar a suíte completa e a homologação humana;
4. corrigir e aprovar o gate editorial E2;
5. registrar a aprovação de lançamento.

Consulte [docs/PHASE_4_IMPLEMENTATION.md](docs/PHASE_4_IMPLEMENTATION.md), [docs/PARITY_MATRIX_PHASE_4.md](docs/PARITY_MATRIX_PHASE_4.md) e o [plano obrigatório do gate E2](docs/editorial-v2/DEF-E2-001-ENRICHMENT-VALIDATION-GATE.md).

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
npm run env:check
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

## Configuração de ambiente

Use `.env.example` como contrato público e sem segredos. Para desenvolvimento local, copie o modelo para `.env.local`; os arquivos locais de ambiente são protegidos pelo `.gitignore` e não devem ser enviados ao GitHub.

| Variável | Obrigatória | Escopo | Ambientes | Origem/configuração |
|---|---:|---|---|---|
| `PUBLIC_BASE_URL` | Sim | Não sensível | Local, Preview e Production | URL local ou domínio da Vercel |
| `MCP_JWT_SECRET` | Sim | Privada, servidor | Preview e Production | Segredo aleatório com pelo menos 32 bytes |
| `SUPABASE_URL` | Sim | Pública | Local, Preview e Production | Supabase Project Settings |
| `SUPABASE_PUBLISHABLE_KEY` | Sim | Pública | Local, Preview e Production | Supabase API Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Privada, servidor | Preview e Production | Supabase API Settings |
| `DATABASE_URL` | Sim durante a migração OAuth | Privada, servidor | Local, Preview e Production | Supabase/Postgres, preferencialmente pooler |
| `ADMIN_PASSWORD` | Não, legado | Privada, servidor | Somente implantação legada | Não configurar sem dependência confirmada |
| `SMOKE_BASE_URL` | Apenas testes smoke | Não sensível | Local, CI ou Preview | URL do ambiente testado |

Nenhuma chave de IA, senha, `service_role`, segredo JWT ou URL privada de banco deve usar prefixo `VITE_` ou `NEXT_PUBLIC_`, nem chegar ao navegador.

Validações disponíveis:

```bash
# Confere se o contrato .env.example contém todas as variáveis esperadas
npm run env:check

# Confere os valores reais do ambiente atual antes de Preview/produção
npm run env:check:runtime
```

A checagem padrão também faz parte de `npm run check`. A checagem de runtime exige que as variáveis obrigatórias estejam efetivamente cadastradas no ambiente atual.

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
briefing → conteúdo estruturado → adapters DeskGo/Frankwatching/AMES
→ gate editorial final → branch → pull request → Vercel Preview
→ testes → homologação → aprovação humana → produção
```

O Preview deve ser bloqueado enquanto o gate E2 estiver incompleto, pendente, falho ou desatualizado em relação à versão e ao hash atuais do conteúdo.

Rollback antes da produção consiste em fechar o PR e remover o Preview. Depois da promoção, reverta o commit de release e restaure o backup do banco conforme o runbook de lançamento.
