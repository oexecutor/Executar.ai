# 13 — Auditoria Rigorosa (independente do pacote G0)

> Auditoria nova, não uma repetição de `00-STATUS-ATUAL.md`. Cada item foi
> re-verificado por leitura direta de código ou execução real de comando
> nesta sessão — nunca aceito por herança do pacote anterior sem nova
> evidência. Metodologia: FATO (comando rodado/código lido nesta sessão),
> EVIDÊNCIA (inferência razoável sem execução direta), LACUNA (não
> verificável neste ambiente), DECISÃO (recomendação objetiva, aprovação
> final é do dono do produto).

- **Data/hora**: 2026-07-28 (sessão Claude Code, execução assistida).
- **SHA auditado**: `HEAD` de `claude/repository-audit-8qy2pz` no momento da
  escrita, base em `origin/main`.
- **Ambiente**: sandbox sem acesso de rede externo a
  `executar-ai.vercel.app` — mesma limitação registrada em
  `00-STATUS-ATUAL.md` §5; nenhuma chamada contra produção foi possível
  nesta sessão.

## 1. Build, teste e lint — re-executados nesta sessão (FATO)

| Comando | Resultado |
|---|---|
| `npm ci` (raiz) | ✅ instalação limpa |
| `npm ci` (`web/`) | ✅ instalação limpa |
| `npm run build` (raiz) | ✅ zero erros TypeScript |
| `npm test` (raiz) | ✅ verde |
| `npm run lint` (raiz) | ✅ zero avisos |
| `npm run build` (`web/`) | ✅ zero erros TypeScript |
| `npm run lint` (`web/`) | ✅ zero avisos |
| `npm test` (`web/`) | ✅ verde |
| `npm audit` (raiz, com e sem `--omit=dev`) | ✅ 0 vulnerabilidades |
| `npm audit` (`web/`, com e sem `--omit=dev`) | ✅ 0 vulnerabilidades |

Nota: o `node_modules` não estava presente no início desta sessão — os
comandos acima só produzem sinal real após `npm ci`. Isso não é um problema
de produto, é uma característica normal de ambiente efêmero, mas reforça por
que nenhuma auditoria deveria aceitar "build limpo" sem rodar o comando de
novo.

## 2. RISK-004 (teste e2e intermitente `/icon.svg`) — RESOLVIDO, não apenas mitigado

`06-PLANO-DE-TESTES.md` (2026-07-24) registrava falha intermitente em "raiz
entra direto no workspace" — hipótese de corrida entre o fetch de
`/icon.svg` e um redirecionamento client-side de `/` para `/app`.

**Achado desta auditoria**: essa hipótese não se aplica mais ao código
atual. `web/e2e/app.spec.ts:133` mostra que a raiz (`/`) hoje renderiza uma
landing pública distinta (`"Contexto complexo. Próxima ação clara."`), sem
redirecionamento automático para `/app` — a arquitetura mudou entre 24/07 e
hoje, o que elimina a corrida que causava a falha.

**Evidência (FATO, rodado nesta sessão)**:
```
npx playwright test e2e/app.spec.ts -g "raiz exibe a landing" --repeat-each=8
→ 8 passed (14.8s)

npx playwright test --repeat-each=3   (suíte completa, 39 testes aplicáveis)
→ 39 passed, 0 flaky (24.9s)
```

**Recomendação**: fechar `RISK-004` e `EXA-G5-QA-001` como resolvidos por
mudança arquitetural, não por correção pontual — registrar em
`04-RISCOS-DECISOES.md` para não reabrir investigação desnecessária em G5.

## 3. Achados novos — não cobertos no pacote G0–G2

### 3.1 Cobertura de teste do frontend é fina

`web/src` tem 43 arquivos-fonte contra 4 arquivos de teste
(`App.test.tsx`, `BlogApp.test.tsx`, `Login.test.tsx`, `Editorial.test.tsx`)
— cobertura unitária de componente em torno de 9%. O risco é parcialmente
compensado por Playwright (13 cenários e2e reais), mas páginas inteiras
(`Today.tsx`, `Portfolio.tsx`, dashboards) não têm teste de componente
isolado, só cobertura indireta via e2e. **Recomendação**: item explícito no
G5, não apenas "corrigir teste flaky" — meta mínima de teste de componente
para as páginas com lógica de estado não trivial.

### 3.2 Nenhum scan de vulnerabilidade de dependências no CI

`.github/workflows/ci.yml` roda `build` + `test` + `lint` em dois jobs
(`check`, `web`), mas nenhum passo executa `npm audit` (ou equivalente,
Dependabot/Snyk). Hoje `npm audit` está limpo (ver §1), mas isso é um estado
pontual, não uma garantia contínua sem o passo no CI. **Recomendação**:
adicionar `npm audit --audit-level=high` (não-bloqueante ou com threshold
alto, para não travar o pipeline por vulnerabilidades transitivas de baixo
risco) aos dois jobs.

### 3.3 Sem monitoramento de erro em produção

Nenhuma dependência de Sentry (ou equivalente) encontrada em `package.json`
(raiz ou `web/`). `api/health.ts` responde apenas liveness
(`{status: "ok"}`), sem checar dependências reais (conexão com banco,
Supabase). Isso significa que uma falha de conexão com o banco em produção
não aparece no health check — só via logs manuais do painel Vercel.
**Recomendação**: (a) expandir `api/health.ts` para checar
`supabaseConfigured()`/conectividade básica; (b) avaliar Sentry ou
Vercel-native error tracking antes de G6 (beta fechado), quando erros reais
de usuários externos passam a importar.

### 3.4 Regra de lint — achado corrigido após verificação

`eslint.config.js:40` marca `@typescript-eslint/no-explicit-any` como
`"warn"`, não `"error"`. Verificação direta de `package.json:15` mostra
`"lint": "eslint . --max-warnings 0"` — ou seja, **qualquer** warning já
quebra o pipeline hoje, incluindo `any`. Não há lacuna real aqui; achado
inicial foi descartado após checar o script real em vez de assumir pelo
nível da regra. Mantido no documento como exemplo do padrão de verificação
usado nesta auditoria (nunca aceitar afirmação sem checar o arquivo
citado).

### 3.5 Datas do roadmap estão desatualizadas

`01-ROADMAP-LANCAMENTO.md` e `02-BACKLOG-LINEAR.md` calculam janelas
"PROPOSTA" a partir de 2026-07-24. Hoje é 2026-07-28 — G2 segue
`EM EXECUÇÃO` conforme `docs/release/README.md`, mas nenhuma das janelas de
gate foi reajustada. Isso não é um bloqueio, mas datas desatualizadas
tendem a virar compromissos implícitos incorretos. **Recomendação**:
rebaseline explícito no próximo fechamento de gate (ver §5).

## 4. Confirmações — achados do pacote G0 revalidados nesta sessão

| Achado anterior | Status confirmado nesta auditoria |
|---|---|
| RISK-001 — fallback público `OWNER` sem login | **Ainda presente** — `src/lib/request-auth.ts:89-107` (lido diretamente nesta sessão). Comentário no próprio código: "Login was removed at the operator's explicit, repeated request" — confirmado também no histórico git (`9cbc3de`, `03bfa55`, `5b1a02f`). |
| RISK-002 — ambiguidade Neon/Supabase | **Ainda aberta** — `src/lib/stores.ts` mantém bifurcação por `supabaseConfigured()`; nenhuma migração ocorreu. |
| DEC-003 — MCP nativo único | **Confirmado resolvido** — único servidor MCP no repositório (`api/mcp.ts` → `src/mcp-server.ts`), nenhuma referência a backend paralelo no código de produção. |
| E2 editorial (branch → PR → Vercel Preview automático) | **Ainda NO-GO**, confirmado por `docs/release/12-HOMOLOGACAO-E2-2026-07-28.md`, o documento mais recente do pacote. |
| Política de privacidade/termos | **Ainda placeholder** — não reavaliado juridicamente nesta sessão (fora do meu escopo como agente de código). |

## 5. Recomendações objetivas para as decisões pendentes

A auditoria anterior (`04-RISCOS-DECISOES.md`) registrou as lacunas sem
recomendar um caminho. Esta auditoria propõe uma decisão para cada uma,
mantendo a aprovação final com o dono do produto:

### DEC-001 — Política de autenticação

**Achado crítico**: a remoção do login foi uma decisão **explícita e
repetida** do próprio dono do produto (três commits distintos: `9cbc3de`,
`03bfa55`, `5b1a02f`), documentada também em `SECURITY.md` como aceitável
apenas para "development, owner-operated use and controlled
demonstrations" — nunca para "beta público ou dados privados de terceiros".

**Recomendação desta auditoria**: não reverter unilateralmente. A
implementação correta, quando o dono do produto decidir abrir para
usuários externos, é login real via Supabase Auth como *adição* ao modo
público atual, não substituição por decreto — o modo público/demo deve
sobreviver atrás de uma flag de ambiente (`ALLOW_PUBLIC_WORKSPACE_FALLBACK`
ou equivalente), explicitamente desligada em qualquer ambiente que
receba dados de terceiros. Isso preserva a decisão histórica do operador
para o caso de uso atual (uso pessoal/demonstração) e cria o caminho para
G6 (beta fechado) sem reescrever a decisão sem consulta.

**Está pendente confirmação explícita do dono do produto antes de qualquer
mudança de código nesta área** — ver nota de execução no fechamento deste
documento.

### DEC-002 — Backend único de persistência

**Recomendação**: Supabase como fonte única. Motivos: (a) já tem RLS ativo
e testado (`supabase/migrations/`, `supabase/tests/workspace_isolation.sql`);
(b) é o caminho mais recente e ativamente desenvolvido (Fase 4, workspaces,
EXECUTA PWA); (c) consolidar em uma única fonte remove a ambiguidade
citada em `RISK-002` sem exigir infraestrutura nova. **Plano de migração
proposto**: registrar ADR descrevendo o que migra (Vault, OAuth, hoje em
Vercel Postgres/Neon) → escrever migração testada com rollback → validar
paridade de dados em ambiente de preview antes de trocar o `stores.ts` em
produção. Este é trabalho de implementação real, não só decisão — estimar
como epic próprio no backlog (ver `14-PLANO-GTM.md` não cobre isso; fica no
roadmap técnico existente, G3).

## 6. Estado resumido desta auditoria

| Área | Estado | Bloqueio |
|---|---|---|
| Build/teste/lint (backend + frontend) | ✅ HOMOLOGADO (re-confirmado nesta sessão) | — |
| Dependências (`npm audit`) | ✅ 0 vulnerabilidades (re-confirmado nesta sessão) | Falta gate automático no CI |
| Playwright / RISK-004 | ✅ RESOLVIDO (39/39, 0 flaky, re-confirmado nesta sessão) | — |
| Autenticação (RISK-001/DEC-001) | 🔲 Decisão pendente do dono do produto | Bloqueia G3/G6 |
| Persistência (RISK-002/DEC-002) | 🔲 Decisão pendente do dono do produto | Bloqueia G3 |
| Cobertura de teste do frontend | ⚠️ Fina (~9%), não bloqueante | G5 |
| Monitoramento de erro em produção | 🔲 Ausente | Recomendado antes de G6 |
| CI — scan de dependências | 🔲 Ausente | Recomendado antes de G3 |
| Jurídico (privacidade/termos) | 🔲 Placeholder, não avaliado juridicamente | G7 |

**Recomendação geral**: **CORRIGIR** antes do próximo gate, mesma
conclusão do pacote anterior — nada aqui é bloqueio estrutural de código,
mas duas decisões do dono do produto (auth, persistência) seguem
bloqueando G3, e agora com uma recomendação objetiva de caminho para cada
uma, em vez de uma lacuna em aberto.
