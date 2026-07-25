# 04 — Riscos e Decisões

> Atualizado em **2026-07-25** após homologação direta no GitHub e na Vercel e
> início do G2. Nenhuma decisão abaixo autoriza lançamento público com dados
> privados.

## Registro de riscos

| ID | Risco | Gravidade | Probabilidade | Impacto | Mitigação / decisão | Responsável | Prazo | Estado |
|---|---|---|---|---|---|---|---|---|
| RISK-001 | **Workspace público compartilhado** — qualquer pessoa com a URL entra como `OWNER` no workspace público | Alta | Certa no comportamento atual | Dados de usuários diferentes poderiam se misturar | Permitido somente durante desenvolvimento interno e demonstrações controladas; não armazenar dados privados; login e isolamento são obrigatórios antes do beta público | Dono do produto | Antes de G6 | Aceito temporariamente |
| RISK-002 | Persistência distribuída entre Vercel Postgres/Neon e componentes Supabase | Média | Média | Drift entre ambientes ou fontes de dados | Manter o contrato atual até G3: Vault e OAuth canônicos em Vercel Postgres; Supabase somente onde já estiver configurado para workspace. Registrar ADR antes de qualquer migração | Produto + Engenharia | G3 | Mitigado / monitorado |
| RISK-003 | Duplicação de servidor MCP | Média | Média | Duas fontes de verdade e manutenção duplicada | A rota nativa `oexecutor/Executar.ai` (`/mcp`) é a implementação canônica; o servidor standalone é legado e não deve ser conectado ao produto principal | Dono do produto | G1 | Resolvido |
| RISK-004 | Teste e2e intermitente relacionado a `/icon.svg` | Média | Média | Ruído na CI e regressões mascaradas | Corrigir e estabilizar em `EXA-G5-QA-001` | Engenharia | G5 | Aberto |
| RISK-005 | Produção não homologada ao vivo | Alta | — | Código poderia estar verde sem funcionar na Vercel | Homologação realizada: produção READY; APIs principais responderam sem 500; erros de runtime do Vault não encontrados nas últimas 24 horas | Engenharia | G1 | Resolvido |
| RISK-006 | Documentos históricos descreviam Netlify e senha de operador | Baixa | — | Agentes poderiam executar instruções obsoletas | Documentos operacionais principais foram migrados para Vercel pelo PR #16 | Engenharia | G1 | Resolvido |
| RISK-007 | PR #9 obsoleto poderia ser mesclado acidentalmente | Baixa | — | Reintrodução de autenticação antiga ou regressão | PR #9 encerrado sem merge em 2026-07-25 | Dono do produto | G1 | Resolvido |
| RISK-008 | Política de privacidade e termos não validados juridicamente | Alta | — | Exposição legal no lançamento público | Validar conteúdo legal antes de G7 | Dono do produto | G7 | Aberto |
| RISK-009 | `plano-operacional-rastreavel` depende de julgamento de LLM, não de endpoint determinístico | Média | Média | Escopo incorreto de engenharia e acoplamento frágil | Usar a skill como gerador externo de proposta `ProjectDoc`; validar deterministicamente e exigir revisão humana antes da persistência; não criar endpoint LLM síncrono no G2 | Produto + Engenharia | G2 | Mitigado / decisão registrada |
| RISK-010 | `ExecutarService` e `DeskOsService` poderiam virar duas fontes operacionais concorrentes | Alta | Média | Dual-write, divergência de progresso e recuperação inconsistente | `ProjectDoc` + `ExecutarService` são canônicos para o ciclo 3–9–36; não fazer dual-write durante G2 | Produto + Engenharia | G2 | Mitigado / monitorado |

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

### DEC-004 — Conexão PLANGEN e fonte canônica do ciclo central

**Decisão:** `ProjectDoc` + `ExecutarService` + `/api/executar/*` formam a fonte
canônica do ciclo 3–9–36. A skill `plano-operacional-rastreavel` gera um
candidato `ProjectDoc` fora do backend transacional. O candidato passa por:

1. validação em `/api/executar/validate`;
2. revisão humana;
3. persistência em `/api/executar/projects`.

Não haverá endpoint LLM síncrono nem dual-write com `DeskOsService` durante o
G2. Recursos maduros de proposta, auditoria e evidência do `DeskOsService`
podem ser absorvidos posteriormente por adaptação explícita, sem trocar a
fonte de verdade.

**Evidência:** contrato e matriz comparativa em
`docs/release/10-G2-CONTRATO-CICLO-CENTRAL.md`.

## Evidências de homologação do G1

Em 2026-07-25 foram confirmados:

- produção Vercel do projeto `executar-ai` em estado `READY`;
- `/api/auth/me`: `200`;
- `/api/executar/projects`: `200` e portfólio carregado;
- `/api/vault/status`: `200`, 5 arquivos, armazenamento Vercel Postgres;
- `/api/vault/files`: `200` e `viewUrl` gerado corretamente;
- `/api/vault/files?path=_desk-os/index/evidence.json`: `200` com conteúdo;
- `/mcp`: `401` autenticável, sem erro de runtime;
- nenhum cluster de erro nas rotas do Vault nas últimas 24 horas;
- PR #14 e PR #9 encerrados sem merge por estarem superados;
- PRs #11, #15, #16 e #17 integrados ao `main`.

## Evidências iniciais do G2

- teste automatizado cobre criação, 81 ações, 9 checkpoints, 100% de progresso,
  exportação e recuperação sobre nova instância do serviço;
- contrato PLANGEN e decisão de fonte única registrados;
- smoke de escrita no ambiente real ainda pendente.

## Decisões históricas preservadas

- Retirar a tela de login e o gate de senha para o ciclo interno do MVP.
- Migrar Netlify Functions + Blobs para Vercel Functions + Postgres.
- Integrar o EXECUTA Journal ao build principal.
- Manter GitHub como fonte documental e Vercel como ambiente de execução.
