# 04 — Riscos e Decisões

## Registro de riscos

| ID | Risco | Gravidade | Probabilidade | Impacto | Mitigação | Responsável | Prazo | Estado |
|---|---|---|---|---|---|---|---|---|
| RISK-001 | **Workspace público compartilhado** — não apropriado para múltiplos usuários nem dados privados; qualquer pessoa com a URL acessa o mesmo workspace com papel `OWNER` (`src/lib/request-auth.ts:89-107`, FATO) | Alta | Certa (comportamento atual confirmado) | Vazamento cruzado de dados entre usuários reais assim que houver mais de um | Resolver DECISÃO NECESSÁRIA #1 antes do G6 (beta) | Dono do produto | Antes de G6 | Aberto |
| RISK-002 | Backend de persistência ambíguo (Neon vs. Supabase, bifurcação em `src/lib/stores.ts:14-27`) pode causar inconsistência de dados entre ambientes | Média | Média | Dados gravados em lugares diferentes conforme configuração do ambiente | Resolver DECISÃO NECESSÁRIA #2 antes do G3 | Dono do produto | Antes de G3 | Aberto |
| RISK-003 | Duplicação de servidor MCP (handoff `executar-mcp-server` vs. implementação nativa) pode gerar confusão de qual é a fonte de verdade se ambos forem mantidos vivos | Baixa | Média | Manutenção duplicada, drift de funcionalidade | Resolver DECISÃO NECESSÁRIA #3 | Dono do produto | Antes de G1 fechar | Aberto |
| RISK-004 | Teste e2e intermitente (`raiz entra direto no workspace, sem tela de login`, `requestfailed /icon.svg`) reproduzido 2/3 execuções nesta auditoria | Média | Alta (flaky, não 100%) | Falsos negativos/positivos em CI, mascarando regressões reais | `EXA-G5-QA-001` | Execução assistida | G5 | Aberto |
| RISK-005 | Sem acesso de rede a produção nesta sessão (proxy do sandbox bloqueia HTTPS externo, 403) | Baixa (limitação de ambiente, não do produto) | Certa neste ambiente | Auditoria não confirma estado real de produção, só o estado do código | Rodar checklist de `README-HOTFIX.md` fora deste sandbox | Dono do produto | Antes de G1 fechar | Aberto |
| RISK-006 | Documentação estrutural (`AGENTS.md`, `SECURITY.md`, `docs/09`, `docs/13`, `docs/DEPLOYMENT_STATUS.md`) descreve arquitetura Netlify/senha de operador que não existe mais no código atual | Baixa | Certa (confirmado por leitura) | Onboarding de qualquer novo colaborador (humano ou IA) parte de premissas erradas | `EXA-G1-DOC-001` | Execução assistida | G1 | Aberto |
| RISK-007 | PR #9 aberto com base muito atrás de `main`, objetivo já resolvido de outra forma | Baixa | — | Merge acidental poderia reintroduzir um mecanismo de auth obsoleto ou reverter arquivos já reescritos | `EXA-G1-BE-002` | Dono do produto | G1 | Aberto |
| RISK-008 | Política de privacidade/termos de uso (`web/public/privacy.html`) não confirmados como conteúdo legal real | Alta (bloqueia lançamento público) | — | Exposição legal/regulatória ao abrir para o grande público | `EXA-G7-DOC-001` | Dono do produto | G7 | Aberto |
| RISK-009 | `plano-operacional-rastreavel` é guiado por julgamento de LLM, sem endpoint síncrono — expectativa de virar "motor de API" pode gerar retrabalho se mal escopada | Média | Média | Esforço de engenharia investido numa abordagem que precisa ser redesenhada | `EXA-G2-PLANGEN-001` — registrar decisão de design antes de codificar | Dono do produto | G2 | Aberto |

## Decisões necessárias (aguardando o dono do produto)

### DECISÃO NECESSÁRIA #1 — Política de autenticação

**Contexto**: `src/lib/request-auth.ts:89-107` documenta, em comentário no
próprio código, que "Login was removed at the operator's explicit, repeated
request". `README-HOTFIX.md` (linhas 81-85) registra isso como "risco
temporário aceito" e recomenda "reative autenticação e isolamento antes do
lançamento externo".

**Opções**:
1. Reativar login obrigatório e isolamento de workspace antes do lançamento
   público (alinhado com a recomendação já registrada no próprio hotfix).
2. Manter o workspace público compartilhado como design definitivo do MVP
   (aceitando que não há isolamento entre usuários).

**Recomendação implícita da documentação já existente**: opção 1, mas a
decisão final é do dono do produto — este documento não a toma por conta
própria.

### DECISÃO NECESSÁRIA #2 — Backend único de persistência

**Contexto**: `src/lib/stores.ts:14-27` — o vault alterna entre
`SupabaseKvStore` e `PostgresKvStore` (Neon) conforme `supabaseConfigured()`;
o armazenamento OAuth é **sempre** Neon, independente dessa configuração.

**Opções**:
1. Supabase como fonte única (auth + dados), Neon descontinuado.
2. Neon como fonte única, Supabase mantido só para autenticação (ou também
   descontinuado, com nova solução de auth).
3. Manter a bifurcação atual, documentando explicitamente por quê.

### DECISÃO NECESSÁRIA #3 — Duplicação de MCP

**Contexto**: este repositório já tem uma implementação MCP nativa completa
e persistida (`api/mcp.ts` → `src/mcp-server.ts`, 18+19 ferramentas, OAuth
2.1+PKCE). O handoff `executar-mcp-server` (revisado em fase anterior desta
conversa) é um servidor MCP standalone, separado, com armazenamento efêmero
em `globalThis` — problema que **não existe** na implementação nativa.

**Opções**:
1. Descartar o handoff inteiro; no máximo, absorver o artefato
   `deskos-project-executar-pm.json` (já convertido para o schema
   checkpoint-primeiro) como dado de exemplo/seed.
2. Investigar se o handoff tem alguma funcionalidade não coberta pela
   implementação nativa antes de descartar.
3. Manter os dois, documentando por que ambos existem (não recomendado —
   contraria `AGENTS.md` regra 5, "Do not create a second independent source
   of truth").

Inclui, em qualquer opção, a decisão sobre descomissionar o projeto Vercel
isolado `executar-mcp-server-vercel-ready` (criado acidentalmente numa sessão
separada do Claude.ai).

## Decisões já tomadas (histórico, preservadas por rastreabilidade)

Estas decisões foram tomadas em fases anteriores do projeto (antes desta
auditoria) e são citadas aqui só para contexto — não estão em aberto:

- Remover a tela de login e o gate de senha de operador, a pedido explícito
  do operador (PR #9, e a arquitetura Fase 4/Supabase que a sucedeu).
- Migrar de Netlify Functions + Blobs para Vercel Functions + Postgres
  (commit `a6ecf27` e correntes).
- Integrar o EXECUTA Journal (blog) ao build principal (trabalho anterior
  desta mesma conversa, mesclado via PR #10).
