# 04 — Riscos e Decisões

> Atualizado em **2026-07-25** após homologação direta no GitHub e na Vercel.
> As três decisões que bloqueavam o G1 foram resolvidas abaixo. Nenhuma delas
> autoriza lançamento público com dados privados.

## Registro de riscos

| ID | Risco | Gravidade | Probabilidade | Impacto | Mitigação / decisão | Responsável | Prazo | Estado |
|---|---|---|---|---|---|---|---|---|
| RISK-001 | **Workspace público compartilhado** — qualquer pessoa com a URL entra como `OWNER` no workspace público | Alta | Certa no comportamento atual | Dados de usuários diferentes poderiam se misturar | Permitido somente durante desenvolvimento interno e demonstrações controladas; não armazenar dados privados; login e isolamento são obrigatórios antes do beta público | Dono do produto | Antes de G6 | Aceito temporariamente |
| RISK-002 | Persistência distribuída entre Vercel Postgres/Neon e componentes Supabase | Média | Média | Drift entre ambientes ou fontes de dados | Manter o contrato atual até G3: Vault e OAuth canônicos em Vercel Postgres; Supabase somente onde já estiver configurado para workspace. Registrar ADR antes de qualquer migração | Produto + Engenharia | G3 | Mitigado / monitorado |
| RISK-003 | Duplicação de servidor MCP | Média | Média | Duas fontes de verdade e manutenção duplicada | A rota nativa `oexecutor/Executar.ai` (`/mcp`) é a implementação canônica; o servidor standalone é legado e não deve ser conectado ao produto principal | Dono do produto | G1 | Resolvido |
| RISK-004 | Teste e2e intermitente relacionado a `/icon.svg` | Média | Média | Ruído na CI e regressões mascaradas | Corrigir e estabilizar em `EXA-G5-QA-001` | Engenharia | G5 | Aberto |
| RISK-005 | Produção não homologada ao vivo | Alta | — | Código poderia estar verde sem funcionar na Vercel | Homologação realizada: produção READY; APIs principais responderam sem 500; erros de runtime do Vault não encontrados nas últimas 24 horas | Engenharia | G1 | Resolvido |
| RISK-006 | Documentos históricos ainda descrevem Netlify e senha de operador | Baixa | Certa | Agentes podem executar instruções obsoletas | Este pacote `docs/release/` passa a ser a referência operacional; atualizar `AGENTS.md`, `SECURITY.md` e documentos legados no restante do G1 | Engenharia | G1 | Em correção |
| RISK-007 | PR #9 obsoleto poderia ser mesclado acidentalmente | Baixa | — | Reintrodução de autenticação antiga ou regressão | PR #9 encerrado sem merge em 2026-07-25 | Dono do produto | G1 | Resolvido |
| RISK-008 | Política de privacidade e termos não validados juridicamente | Alta | — | Exposição legal no lançamento público | Validar conteúdo legal antes de G7 | Dono do produto | G7 | Aberto |
| RISK-009 | `plano-operacional-rastreavel` depende de julgamento de LLM, não de endpoint determinístico | Média | Média | Escopo incorreto de engenharia | Fechar decisão de design em `EXA-G2-PLANGEN-001` antes de codificar integração | Produto | G2 | Aberto |

## Decisões resolvidas

### DEC-001 — Política de autenticação

**Decisão:** manter temporariamente o acesso direto ao workspace público para o
MVP interno, demonstrações e homologação, preservando a decisão explícita do
dono do produto de retirar a tela de login.

**Limite obrigatório:** isso não é autorização para beta público com dados de
terceiros. Antes do G6 devem existir autenticação e isolamento por workspace,
ou o produto deve permanecer restrito a um único workspace demonstrativo sem
dados privados.

**Evidência atual:** `GET /api/auth/me` responde `200` com usuário e workspace
`public`, papel `OWNER`.

### DEC-002 — Persistência durante o ciclo G1–G3

**Decisão:** não executar uma migração de dados durante o hotfix. Manter e
documentar o contrato real em produção:

- Vault e OAuth: **Vercel Postgres/Neon**;
- workspace Supabase: utilizado somente quando as variáveis correspondentes
  estiverem configuradas;
- qualquer unificação futura exige ADR, migração testada e rollback.

**Evidência atual:** `GET /api/vault/status` informa armazenamento
`Vercel Postgres`; `src/lib/stores.ts` mantém fallback explícito para
`PostgresKvStore` e usa `SupabaseKvStore` apenas quando configurado.

### DEC-003 — Fonte única do MCP

**Decisão:** a implementação MCP canônica é a que vive neste repositório:

- `api/mcp.ts`;
- `src/mcp-server.ts`;
- endpoint de produção `https://executar-ai.vercel.app/mcp`;
- OAuth e persistência compartilhados com o aplicativo.

O repositório/servidor standalone `Executar-mcp-server` não deve ser tratado
como backend do EXECUTA.AI nem conectado em paralelo. Ele pode permanecer
apenas como referência histórica até ser arquivado ou removido em ação
separada.

**Evidência atual:** `GET /mcp` responde `401` com `WWW-Authenticate` e metadata
OAuth, comportamento esperado para um recurso MCP protegido; não retorna 500.

## Evidências de homologação do G1

Em 2026-07-25 foram confirmados:

- produção Vercel do projeto `executar-ai` em estado `READY` no commit
  `308227130147c94268e268abd8601a1a8dce2580` antes da integração documental;
- `/api/auth/me`: `200`;
- `/api/executar/projects`: `200` e portfólio carregado;
- `/api/vault/status`: `200`, 5 arquivos, armazenamento Vercel Postgres;
- `/api/vault/files`: `200` e `viewUrl` gerado corretamente;
- `/api/vault/files?path=_desk-os/index/evidence.json`: `200` com conteúdo;
- `/mcp`: `401` autenticável, sem erro de runtime;
- nenhum cluster de erro nas rotas do Vault nas últimas 24 horas;
- PR #14 encerrado sem merge porque o `main` já contém implementação
  equivalente e mais recente;
- PR #9 encerrado sem merge por estar superado pela arquitetura atual.

## Decisões históricas preservadas

- Retirar a tela de login e o gate de senha para o ciclo interno do MVP.
- Migrar Netlify Functions + Blobs para Vercel Functions + Postgres.
- Integrar o EXECUTA Journal ao build principal.
- Manter GitHub como fonte documental e Vercel como ambiente de execução.
