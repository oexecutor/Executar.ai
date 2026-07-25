# 00 — Status Atual

> Supera `docs/DEPLOYMENT_STATUS.md` (2026-07-19, alvo Netlify, projeto
> `desk-os-vault-mcp-openai`). O ambiente atual é **Vercel**, projeto
> `executar-ai`, produção `https://executar-ai.vercel.app` — ver `vercel.json`
> na raiz do repositório. `docs/GATE_PROGRESS.md`, `AGENTS.md`, `SECURITY.md` e
> `docs/09_SECURITY_AND_GOVERNANCE.md`/`docs/13_DECISIONS_GAPS_ASSUMPTIONS.md`
> também descrevem o modelo operacional Netlify anterior (senha de operador,
> `netlify dev`) — isso não reflete mais o código real (ver §4 e
> `04-RISCOS-DECISOES.md`).

## Resumo executivo

O EXECUTA.AI é hoje um projeto **Vercel** funcional: build, testes e lint
passam limpos tanto no backend (`api/*.ts`) quanto no frontend (`web/`), o
EXECUTA Journal (blog) está integrado, e o hotfix P0 de runtime (adapter
Vercel Node→Web) está presente e aplicado uniformemente em todos os handlers.
O maior risco aberto não é técnico-funcional, é de **modelo de acesso**: o
login existe mas não é aplicado — qualquer requisição sem sessão cai num
workspace público compartilhado com papel `OWNER`. Isso foi uma decisão
deliberada do operador em fases anteriores, mas precisa de uma decisão
explícita antes do lançamento público (ver DECISÃO NECESSÁRIA #1 em
`04-RISCOS-DECISOES.md`). Há também uma ambiguidade real sobre qual backend de
persistência (Neon ou Supabase) é a fonte de verdade de produção, um teste
e2e intermitente reproduzido nesta auditoria, e uma decisão pendente sobre o
que fazer com o servidor MCP duplicado do handoff `executar-mcp-server`.
Recomendação: **CORRIGIR** antes de avançar — nada aqui é um bloqueio
estrutural, mas três decisões do dono do produto precisam ser tomadas antes do
próximo gate técnico.

## Auditoria — data e evidência

- **Data/hora da auditoria**: 2026-07-24 (sessão Claude Code on the web).
- **SHA atual (`origin/main`)**: `28a689ffee0fd87b31c8cbc59abda4c511c1edf1`
  ("fix(runtime): adapt remaining Vercel handlers, fix login-free access,
  integrate blog").
- **Branch de trabalho desta auditoria**: `claude/executar-ai-desk-os-migration-ctul7o`,
  reiniciada a partir de `origin/main` fresco nesta sessão (o único commit que
  a branch tinha antes disso, `311ab38`, era idêntico em conteúdo ao commit
  `a6ecf27` já mesclado em `main` — nada foi perdido).
- **Deployment atual de produção**: projeto Vercel `executar-ai`,
  `https://executar-ai.vercel.app`. **LACUNA** — o proxy de rede deste sandbox
  bloqueia (403, `CONNECT tunnel failed`) qualquer chamada HTTPS de saída para
  domínios não permitidos, incluindo `executar-ai.vercel.app`; não foi
  possível confirmar nesta sessão qual commit está de fato publicado nem o
  status HTTP real das rotas em produção. `DIAGNOSTICO-HOTFIX.md` (24/07)
  registrou erros em produção no commit `5b1a02f9`; o código em `origin/main`
  hoje (`28a689f`) já contém a correção (ver §4), mas isso não foi
  reverificado ao vivo nesta auditoria.
- **Pull requests abertos no repositório**:
  - **PR #9** — "fix(auth): disable Gate 0.5 operator-password gate" — base
    `aeb1249` (muito atrás do `main` atual). **Achado**: o objetivo do PR
    (remover o gate de senha de operador) já foi alcançado em `main` por um
    mecanismo diferente e mais recente (`src/lib/admin-guard.ts` sobre
    `src/lib/request-auth.ts`, modelo de workspace público Supabase/Fase 4).
    Recomendação: fechar o PR #9 sem merge (ver `04-RISCOS-DECISOES.md`).
  - **PR #4** — "feat(ames): Adaptive Multi-format Editorial System skill
    package" — draft, 86 arquivos, sem relação com o lançamento do
    EXECUTA.AI. Fora do escopo deste roadmap; só citado por completude.

## Tabela — Área × Estado × Evidência × Bloqueio × Próxima ação

| Área | Estado | Evidência | Bloqueio | Próxima ação |
|---|---|---|---|---|
| Backend — build/tipos | HOMOLOGADO | `npm run build` limpo (FATO, rodado nesta sessão) | — | Manter em CI |
| Backend — testes | HOMOLOGADO | `npm test`: 21 arquivos / 140 testes verdes (FATO) | — | Manter em CI |
| Backend — lint | HOMOLOGADO | `npm run lint`: 0 avisos (FATO) | — | Manter em CI |
| Backend — runtime Vercel (adapter Node→Web) | IMPLEMENTADO | `src/lib/vercel-node-adapter.ts` aplicado a todos os `api/*.ts` (FATO, leitura direta) | Confirmação ao vivo em produção (LACUNA de rede) | Rodar smoke test GET quando houver acesso de rede |
| Backend — autenticação | BLOQUEADO (decisão) | `src/lib/request-auth.ts:89-107` — login não é aplicado, fallback público `OWNER` (FATO) | DECISÃO NECESSÁRIA #1 | Dono do produto decide política de auth antes do G3 |
| Backend — persistência (Neon/Supabase) | BLOQUEADO (decisão) | `src/lib/stores.ts:14-27` — vault bifurca por `supabaseConfigured()`, OAuth é sempre Neon (FATO) | DECISÃO NECESSÁRIA #2 | Dono do produto decide backend único de produção |
| Backend — MCP nativo (`/mcp`) | IMPLEMENTADO | `api/mcp.ts` → `src/mcp-server.ts`, 18+19 ferramentas, OAuth 2.1+PKCE completo (FATO) | Duplicação com handoff externo | DECISÃO NECESSÁRIA #3 |
| Frontend — build/lint/testes | HOMOLOGADO | `npm run build:web`/`lint:web`/`test:web` limpos, 10 testes verdes (FATO) | — | Manter em CI |
| Frontend — e2e + acessibilidade (Playwright/axe) | EM TESTE | 10/11 testes verdes; 1 teste intermitente reproduzido 2/3 execuções (FATO, ver §5) | Falha intermitente em `/icon.svg` no teste da raiz | Investigar e corrigir (G5) |
| Blog — EXECUTA Journal | HOMOLOGADO | Integrado (`web/src/blog/*`), testes de componente e e2e verdes, PWA (`manifest.webmanifest`, `sw.js`, `icon.svg`) presentes no build (FATO) | — | Regressão de rotina |
| Qualidade — smoke test OAuth | LACUNA | `npm run test:smoke` requer `SMOKE_BASE_URL`; nenhum preview deployment conhecido nesta sessão | Falta de URL de preview | Rodar contra preview antes do próximo gate |
| Qualidade — produção ao vivo | LACUNA | Rede do sandbox bloqueia HTTPS externo (403) | Ambiente sem acesso de rede externo | Rodar checklist de `README-HOTFIX.md` fora deste sandbox |
| Documentação — `docs/`, `AGENTS.md`, `SECURITY.md` | EM DESENVOLVIMENTO | Descrevem arquitetura Netlify/operador pré-migração (FATO, leitura direta) — desatualizados frente ao `main` atual | Nenhum (não impede lançamento) | Atualizar em G1 (epic DOC) |
| Governança — PR #9 | BLOQUEADO (decisão) | Base `aeb1249`, objetivo já resolvido de outra forma em `main` | Precisa decisão de fechar/rebasear | Dono do produto decide |
| Skills — DESK-OS / plano-operacional-rastreável / Desk&Go Workbook / handoff MCP | NÃO INICIADO (integração) | Revisadas nesta conversa, arquivos em `scratchpad/skills-review/` | 3 decisões necessárias (auth/persistência não se aplicam aqui; ver G1/G2/G7) | Ver `01-ROADMAP-LANCAMENTO.md` §Fase F |

## Decisão recomendada

**CORRIGIR.** O núcleo técnico está saudável (build/test/lint 100% verdes,
blog integrado, hotfix de runtime presente no código), mas três decisões do
dono do produto — política de autenticação, backend de persistência único, e
destino do MCP duplicado — precisam ser tomadas antes de qualquer gate
seguinte poder ser estimado com precisão. Nenhum desses itens é um bloqueio
estrutural (não é preciso reescrever nada), mas também não são decisões que
eu deva tomar sozinho.

Ver o bloco de fechamento completo (STATUS ATUAL / DECISÃO RECOMENDADA /
PRÓXIMA AÇÃO ÚNICA / DATA PROPOSTA / BLOQUEADORES / TOTAIS) na mensagem de
entrega desta auditoria, e o detalhamento de riscos e decisões em
`04-RISCOS-DECISOES.md`.
