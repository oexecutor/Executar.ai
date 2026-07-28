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
> O relatório preserva o estado observado em 27/07/2026. Mudanças posteriores,
> incluindo o merge do PR #4, devem ser avaliadas como eventos novos e não
> alteram retroativamente as evidências daquela auditoria.

## Estado

> [!CAUTION]
> **E2 oficial da Issue #23 — NO-GO para lançamento.** A E2 é a automação
> GitHub + Vercel Preview. O gate determinístico atual pertence à E1 e não
> executa Desk&Go, Frankwatching ou AMES. Consulte o
> [contrato da E2](docs/editorial-v2/03-E2-GITHUB-VERCEL-AUTOMATION.md) e o
> [registro de reclassificação](docs/editorial-v2/DEF-E2-001-ENRICHMENT-VALIDATION-GATE.md).

A Fase 4 entrega a fundação funcional em uma branch de Preview. Ela não autoriza publicação em produção. A promoção só pode ocorrer depois de:

1. aplicar e validar a migração Supabase;
2. configurar os secrets do Preview;
3. executar a suíte completa e a homologação humana;
4. homologar a automação GitHub + Vercel Preview da E2 ponta a ponta;
5. registrar a aprovação de lançamento.

Consulte [docs/PHASE_4_IMPLEMENTATION.md](docs/PHASE_4_IMPLEMENTATION.md),
[docs/PARITY_MATRIX_PHASE_4.md](docs/PARITY_MATRIX_PHASE_4.md) e o
[contrato da automação E2](docs/editorial-v2/03-E2-GITHUB-VERCEL-AUTOMATION.md).

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
| `EDITORIAL_GITHUB_TOKEN` | Para E2 | Privada, servidor | Preview e Production | Token granular: Contents e Pull requests com escrita |
| `EDITORIAL_GITHUB_REPOSITORY` | Override opcional da E2 | Não sensível | Preview e Production | Padrão: `oexecutor/P1.Executar.ai` |
| `EDITORIAL_GITHUB_BASE_BRANCH` | Override opcional da E2 | Não sensível | Preview e Production | Padrão: `main` |
| `EDITORIAL_VERCEL_TOKEN` | Para E2 | Privada, servidor | Preview e Production | Token de leitura do projeto |
| `EDITORIAL_VERCEL_PROJECT_ID` | Override opcional da E2 | Não sensível | Preview e Production | Padrão: projeto `executar-ai` |
| `EDITORIAL_VERCEL_TEAM_ID` | Override opcional da E2 | Não sensível | Preview e Production | Padrão: equipe `oexecutor-9118s-projects` |

Aliases server-side aceitos para aproveitar credenciais de CI existentes:
`GITHUB_TOKEN` ou `GH_TOKEN` para GitHub e `VERCEL_TOKEN` para Vercel. Os nomes
`EDITORIAL_*` têm prioridade e nenhum token pode usar prefixo público.
| `ADMIN_PASSWORD` | Não, legado | Privada, servidor | Somente implantação legada | Não configurar sem dependência confirmada |
| `SMOKE_BASE_URL` | Apenas testes smoke | Não sensível | Local, CI ou Preview | URL do ambiente testado |

Nenhuma chave de IA, senha, `service_role`, segredo JWT ou URL privada de banco deve usar prefixo `VITE_` ou `NEXT_PUBLIC_`, nem chegar ao navegador.

Validações disponíveis:

```bash
# Confere se o contrato .env.example contém todas as variáveis esperadas
npm run env:check

# Confere os valores reais do ambiente atual antes de Preview/produção
npm run env:check:runtime

# Exige e valida as seis variáveis server-side da E2
npm run env:check:editorial-e2
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
E1: briefing → conteúdo estruturado → regras internas → pacote aprovado
→ E2: artigo/assets → branch → commit → PR draft → Vercel Preview do mesmo SHA
→ testes → homologação → aprovação humana → produção
```

O Preview é bloqueado enquanto a E1 estiver incompleta e só pode ser
registrado pela E2 automática. Branch, SHA, PR, URL e deployment fornecidos
pelo cliente são rejeitados.

Rollback antes da produção consiste em fechar o PR e remover o Preview. Depois da promoção, reverta o commit de release e restaure o backup do banco conforme o runbook de lançamento.
