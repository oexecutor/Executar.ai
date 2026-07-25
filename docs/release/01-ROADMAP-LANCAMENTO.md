# 01 — Roadmap de Lançamento

> Os Gates **G0–G10** aqui descritos são sobre **prontidão de lançamento**.
> **Não confundir** com os Gates 0–5 de `docs/GATE_PROGRESS.md`, que
> documentam a migração de backend DESK-OS (domínio → repositório →
> aplicação → MCP → API), já concluída e mesclada em `main` antes da migração
> Netlify→Vercel. Aquele trabalho é um dos insumos do baseline do novo G0,
> não um eixo paralelo de gates.

Capacidade de referência usada neste roadmap: **25 horas/semana**, uma entrega
principal por dia, até três passos visíveis por tarefa, ondas de execução de
aproximadamente 72 horas corridas. Nenhuma data de lançamento aprovada existe
hoje — as datas abaixo são calculadas pelo caminho crítico e marcadas como
**PROPOSTA**, nunca como compromisso (ver `02-BACKLOG-LINEAR.csv` para o
detalhamento issue a issue).

---

## GATE 0 — Auditoria e baseline confiável

- **Objetivo**: estabelecer um registro factual e verificável do estado real
  do produto, sem confiar em documentação antiga.
- **Entregáveis**: este pacote de 10 documentos + `docs/release/02-BACKLOG-LINEAR.csv`/`.json`.
- **Dependências**: nenhuma.
- **Riscos**: nenhum além dos já registrados em `04-RISCOS-DECISOES.md`.
- **Tarefas**: ver epic `DOC` em `02-BACKLOG-LINEAR.csv` (`EXA-G0-DOC-001`).
- **Critérios de aceite**: build/test/lint locais verdes (FATO, confirmado);
  10 arquivos presentes em `docs/release/`; CSV parseável.
- **Evidências necessárias**: saída de `npm run check`, `npm run build:web && npm run test:web && npm run lint:web`, `npx playwright test`.
- **Condição de entrada**: nenhuma — ponto de partida.
- **Condição de saída**: usuário revisa a prévia e responde `APROVADO PARA LINEAR` (ou pede ajustes).
- **Responsável**: dono do produto (revisão) + execução assistida.
- **Esforço estimado**: 6h.
- **Janela recomendada**: 2026-07-24 (hoje).
- **Decisão final**: aguardando aprovação do usuário.

## GATE 1 — Runtime e infraestrutura estáveis

- **Objetivo**: eliminar ambiguidade de infraestrutura antes de construir em
  cima dela — confirmar o hotfix de runtime em produção, resolver a
  duplicação de MCP, atualizar documentação estrutural obsoleta.
- **Entregáveis**: confirmação viva do hotfix; decisão registrada sobre o
  handoff `executar-mcp-server`; `AGENTS.md`/`SECURITY.md`/`package.json`
  atualizados para refletir Vercel (não Netlify).
- **Dependências**: G0.
- **Riscos**: sem acesso de rede a produção nesta sessão (LACUNA); decisão de
  MCP pode exigir absorver código do handoff.
- **Tarefas**: epics `BE`, `MCP`, `DOC` — `EXA-G1-BE-001`, `EXA-G1-BE-002`,
  `EXA-G1-MCP-001`, `EXA-G1-DOC-001`.
- **Critérios de aceite**: `curl -i https://executar-ai.vercel.app/api/auth/me|/api/executar/projects|/mcp` sem 500; PR #9 fechado ou rebaseado conscientemente; decisão de MCP registrada em `04-RISCOS-DECISOES.md`.
- **Evidências necessárias**: saída dos `curl` acima; commit de atualização de docs.
- **Condição de entrada**: G0 aprovado.
- **Condição de saída**: os 4 itens acima concluídos ou explicitamente adiados com decisão registrada.
- **Responsável**: dono do produto (decisões) + execução assistida (implementação).
- **Esforço estimado**: 9h.
- **Janela recomendada (PROPOSTA)**: 2026-07-25 a 2026-07-27.
- **Decisão final**: pendente das 3 decisões necessárias (ver `04-RISCOS-DECISOES.md`).

## GATE 2 — Ciclo central do produto funcional

- **Objetivo**: validar ponta a ponta o ciclo entrada de contexto →
  estruturação por IA → criação do projeto → fases/tarefas → próxima ação →
  checkpoints → evidência → painel/exportação → persistência → recuperação,
  em produção real — e decidir como as skills DESK-OS/plano-operacional se
  conectam a esse ciclo.
- **Entregáveis**: relatório de validação ponta a ponta; decisão registrada
  sobre a conexão do motor `plano-operacional-rastreavel`.
- **Dependências**: G1 (runtime confirmado).
- **Riscos**: `plano-operacional-rastreavel` é hoje guiado por julgamento de
  LLM, sem endpoint síncrono — conectá-lo ao ciclo central é uma iniciativa
  de redesenho, não uma tarefa trivial.
- **Tarefas**: epics `BE`, `DESKOS`, `PLANGEN` — `EXA-G2-BE-001`,
  `EXA-G2-DESKOS-001`, `EXA-G2-PLANGEN-001`.
- **Critérios de aceite**: projeto criado e persistido via `/api/executar` ou `/mcp`; reload preserva dados; decisão de design do PLANGEN registrada (mesmo que a decisão seja "não conectar agora").
- **Evidências necessárias**: sessão gravada do ciclo completo; captura do estado persistido.
- **Condição de entrada**: G1 aprovado.
- **Condição de saída**: ciclo validado + decisão PLANGEN registrada.
- **Responsável**: dono do produto (decisão PLANGEN) + execução assistida.
- **Esforço estimado**: 18h.
- **Janela recomendada (PROPOSTA)**: 2026-07-28 a 2026-08-02.
- **Decisão final**: pendente.

## GATE 3 — Persistência, segurança e integridade dos dados

- **Objetivo**: resolver a política de autenticação e o backend único de
  persistência, e confirmar presença de variáveis de ambiente de produção.
- **Entregáveis**: `src/lib/request-auth.ts`/`src/lib/stores.ts` ajustados
  conforme decisão; checklist de variáveis de ambiente confirmado por
  presença.
- **Dependências**: G1.
- **Riscos**: risco do **workspace público** citado explicitamente — não é
  apropriado para múltiplos usuários nem dados privados, precisa ser
  resolvido antes do lançamento ao grande público (ver `04-RISCOS-DECISOES.md`).
- **Tarefas**: epics `SEC`, `DATA` — `EXA-G3-SEC-001`, `EXA-G3-DATA-001`,
  `EXA-G3-SEC-002`.
- **Critérios de aceite**: decisão de auth implementada; um único backend de
  persistência documentado como fonte de verdade; variáveis de ambiente
  confirmadas presentes (nomes, nunca valores).
- **Evidências necessárias**: diff de código da decisão implementada; lista
  de nomes de variáveis confirmadas.
- **Condição de entrada**: decisões #1 e #2 tomadas pelo dono do produto.
- **Condição de saída**: zero ambiguidade sobre quem pode acessar o quê e
  onde os dados vivem.
- **Responsável**: dono do produto (decisão) + execução assistida (implementação).
- **Esforço estimado**: 3h (decisão + confirmação; implementação decorrente é TBD até a decisão existir).
- **Janela recomendada (PROPOSTA)**: 2026-08-03.
- **Decisão final**: pendente.

## GATE 4 — EXECUTA Journal integrado

- **Objetivo**: confirmar que o blog segue estável após as mudanças dos
  gates anteriores.
- **Entregáveis**: regressão do blog em produção real.
- **Dependências**: G1.
- **Riscos**: baixo — já `HOMOLOGADO` localmente (PR #10 mesclado nesta
  mesma conversa, anterior a esta auditoria).
- **Tarefas**: epic `BLOG` — `EXA-G4-BLOG-001`.
- **Critérios de aceite**: deep link abre artigo direto sem 404; busca e
  carrossel funcionam; sem violações de acessibilidade críticas/sérias.
- **Evidências necessárias**: `npm run test:web:e2e` (já verde localmente,
  ver `06-PLANO-DE-TESTES.md`) + verificação manual em produção quando houver
  acesso de rede.
- **Condição de entrada**: G1 aprovado.
- **Condição de saída**: regressão sem achados novos.
- **Responsável**: execução assistida.
- **Esforço estimado**: 2h.
- **Janela recomendada (PROPOSTA)**: 2026-08-04.
- **Decisão final**: n/a (sem decisão pendente).

## GATE 5 — Qualidade, acessibilidade e Playwright

- **Objetivo**: fechar o único achado de qualidade real desta auditoria — o
  teste e2e intermitente — e avaliar extensão de cobertura de acessibilidade.
- **Entregáveis**: teste "raiz entra direto no workspace" estável (0 flakiness
  em 10 repetições); relatório de cobertura de a11y.
- **Dependências**: G1.
- **Riscos**: causa raiz provável é uma corrida entre o carregamento de
  `/icon.svg` e um redirecionamento client-side de `/` para `/app` — precisa
  de investigação, não é assumida aqui.
- **Tarefas**: epic `QA` — `EXA-G5-QA-001`, `EXA-G5-QA-002`.
- **Critérios de aceite**: zero testes falhando/flaky; Playwright verde em 10
  repetições consecutivas.
- **Evidências necessárias**: saída de `npx playwright test --repeat-each=10`.
- **Condição de entrada**: G1 aprovado.
- **Condição de saída**: suíte 100% estável.
- **Responsável**: execução assistida.
- **Esforço estimado**: 7h.
- **Janela recomendada (PROPOSTA)**: 2026-08-05 a 2026-08-06.
- **Decisão final**: n/a.

## GATE 6 — Beta fechado

- **Objetivo**: desenhar e abrir um beta fechado para um grupo pequeno e
  controlado de usuários.
- **Entregáveis**: fluxo de convite/onboarding.
- **Dependências**: G2, G3, G5.
- **Riscos**: não existe fluxo de convite hoje — construção nova, não ajuste.
- **Tarefas**: epic `REL` — `EXA-G6-REL-001`.
- **Critérios de aceite**: convite funcional, onboarding em até 3 passos
  visíveis (regra de produto do `AGENTS.md`, ainda válida).
- **Evidências necessárias**: sessão gravada do fluxo de convite → primeiro
  uso.
- **Condição de entrada**: G2/G3/G5 aprovados.
- **Condição de saída**: pelo menos 1 usuário externo completou onboarding.
- **Responsável**: dono do produto (lista de convidados) + execução assistida.
- **Esforço estimado**: 8h.
- **Janela recomendada (PROPOSTA)**: 2026-08-07 a 2026-08-09.
- **Decisão final**: n/a.

## GATE 7 — Preparação comercial e operacional

- **Objetivo**: fechar os pré-requisitos legais/operacionais do lançamento
  público e decidir o destino do `deskgo-business-workbook`.
- **Entregáveis**: política de privacidade e termos de uso reais (hoje
  `web/public/privacy.html` existe como placeholder, não confirmado como
  conteúdo legal real — ver `05-CHECKLIST-LANCAMENTO.md`); plano de suporte;
  decisão sobre o workbook.
- **Dependências**: G6.
- **Riscos**: sem plano jurídico/suporte definido, não se pode abrir ao
  grande público (ver `08_CRITÉRIOS` do prompt original / `05-CHECKLIST-LANCAMENTO.md`).
- **Tarefas**: epics `DOC`, `WORKBOOK`, `REL` — `EXA-G7-DOC-001`,
  `EXA-G7-WORKBOOK-001`, `EXA-G7-REL-002`.
- **Critérios de aceite**: política de privacidade e termos publicados e
  revisados por alguém com competência jurídica (fora do escopo desta
  auditoria automatizar); plano de suporte documentado; decisão do workbook
  registrada.
- **Evidências necessárias**: URLs publicadas; documento de plano de suporte.
- **Condição de entrada**: G6 aprovado.
- **Condição de saída**: nenhum item de `05-CHECKLIST-LANCAMENTO.md` da
  seção jurídica/privacidade/suporte em aberto.
- **Responsável**: dono do produto.
- **Esforço estimado**: 11h.
- **Janela recomendada (PROPOSTA)**: 2026-08-10 a 2026-08-12.
- **Decisão final**: pendente (decisão do workbook).

## GATE 8 — Release Candidate

- **Objetivo**: cortar um Release Candidate estável.
- **Entregáveis**: branch/tag de RC; critérios de corte aplicados.
- **Dependências**: G7.
- **Riscos**: baixo, gate de disciplina de processo.
- **Tarefas**: epic `REL` — `EXA-G8-REL-001`.
- **Critérios de aceite**: `03-GATES-DE-RELEASE.md` 100% satisfeito.
- **Evidências necessárias**: tag Git, changelog atualizado.
- **Condição de entrada**: G7 aprovado.
- **Condição de saída**: RC taggeado.
- **Responsável**: dono do produto (aprovação final) + execução assistida.
- **Esforço estimado**: 2h.
- **Janela recomendada (PROPOSTA)**: 2026-08-13.
- **Decisão final**: n/a.

## GATE 9 — Lançamento público

- **Objetivo**: publicar o RC para o grande público.
- **Entregáveis**: checklist de go-live executado; domínio e monitoramento
  ativos.
- **Dependências**: G8.
- **Riscos**: irreversível sem rollback (ver `07-PLANO-DE-ROLLBACK.md`).
- **Tarefas**: epic `OPS`/`REL` — `EXA-G9-OPS-001`.
- **Critérios de aceite**: todos os critérios de `08. Critérios para
  lançamento público` (ver `04-RISCOS-DECISOES.md`/`05-CHECKLIST-LANCAMENTO.md`)
  satisfeitos.
- **Evidências necessárias**: checklist assinado pelo dono do produto.
- **Condição de entrada**: G8 aprovado + aprovação humana explícita.
- **Condição de saída**: produto no ar publicamente.
- **Responsável**: dono do produto (aprovação final, não delegável).
- **Esforço estimado**: 3h.
- **Janela recomendada (PROPOSTA)**: 2026-08-14.
- **Decisão final**: pendente (aprovação humana final, sempre).

## GATE 10 — Operação e acompanhamento pós-lançamento

- **Objetivo**: operar o produto lançado com disciplina de revisão.
- **Entregáveis**: revisões de 24h/7d/30d; métricas de ativação/retenção.
- **Dependências**: G9.
- **Riscos**: operação solo-founder, sem equipe de plantão formal.
- **Tarefas**: epic `OPS` — `EXA-G10-OPS-001`.
- **Critérios de aceite**: 3 revisões realizadas e documentadas.
- **Evidências necessárias**: relatórios de revisão.
- **Condição de entrada**: G9 concluído.
- **Condição de saída**: ciclo contínuo — este gate não "fecha", vira
  operação regular.
- **Responsável**: dono do produto.
- **Esforço estimado**: 3h (primeira rodada).
- **Janela recomendada (PROPOSTA)**: a partir de 2026-08-15.
- **Decisão final**: n/a.

---

## Fase F — Skills e handoff MCP como epics formais

As 3 skills revisadas em fase anterior desta conversa e o handoff do
`executar-mcp-server` entram nos gates acima como epics reais, não como notas
soltas:

- **`MCP` (G1)** — handoff `executar-mcp-server`: reconciliar com a
  implementação nativa já mais madura deste repositório (`api/mcp.ts` →
  `src/mcp-server.ts`, já persistida via Neon/Supabase). O problema de
  "armazenamento efêmero em `globalThis`" descrito no handoff **não existe**
  na implementação nativa — isso pesa a favor de descartar o servidor inteiro
  e no máximo aproveitar o artefato já convertido
  `deskos-project-executar-pm.json` (schema checkpoint-primeiro). Decisão
  final é do dono do produto (`DECISÃO NECESSÁRIA #3`). Inclui o fechamento
  do projeto Vercel isolado `executar-mcp-server-vercel-ready` depois que o
  que for aproveitável for absorvido.
- **`DESKOS` (G2)** — skill `desk-os-neurocompatible-projects`: mesma lógica
  3×9×36 e hierarquia `projeto → fase → área → item → ação → evidência` já
  usada por `DeskOsService`/`registerDeskOsTools`. Trabalho é de confirmação
  de contrato, não de construção nova.
- **`PLANGEN` (G2)** — skill `plano-operacional-rastreavel`: motor
  guiado por julgamento de LLM (evidência FACT/DECISION/ASSUMPTION/GAP/CONFLICT,
  limite normativo ISO fixo, pacote de 4 entregáveis). Conectá-lo ao ciclo
  central como gerador de plano assistido por IA é uma iniciativa de
  redesenho — hoje não existe um endpoint síncrono sem LLM no loop para isso.
  Registrado como decisão de design, não implementação trivial.
- **`WORKBOOK` (G7)** — skill `deskgo-business-workbook`: gerador de 5 peças
  SVG de negócio. Decisão pendente: vira feature/oferta do produto ou fica
  como skill de uso interno/consultoria, fora do app.

Cada epic acima gera issues reais em `02-BACKLOG-LINEAR.csv`/`.json`, com
`Source File` apontando para o arquivo real (código do repositório ou o path
do zip/skill já extraído em `scratchpad/skills-review/`).
