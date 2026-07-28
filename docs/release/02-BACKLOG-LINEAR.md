# 02 — Backlog para o Linear (prévia auditável)

Este documento é a narrativa de apoio a `02-BACKLOG-LINEAR.csv` (fonte
importável) e `02-BACKLOG-LINEAR.json` (fonte estruturada, mesma informação
aninhada por gate → epic → issue). **Nenhuma tarefa foi criada no Linear** —
esta é a prévia auditável pedida antes de `APROVADO PARA LINEAR`, e nenhum
conector do Linear está disponível nesta sessão (ver §Limitação abaixo).

## Namespacing

- **Project**: constante `EXECUTA.AI — LANÇAMENTO PÚBLICO`.
- **Milestone**: um por gate, `G{n} — {nome do gate}`.
- **Epic / Issue ID**: vocabulário fixo de área — `BE` (backend), `FE`
  (frontend), `BLOG`, `QA`, `SEC`, `DATA`, `MCP`, `DOC`, `REL`, `OPS`, `GTM`
  (adicionado em 2026-07-28, ver `14-PLANO-GTM.md`), e três
  áreas para as skills revisadas nesta conversa: `PLANGEN`
  (`plano-operacional-rastreavel`), `DESKOS` (`desk-os-neurocompatible-projects`
  + handoff `executar-mcp-server`), `WORKBOOK` (`deskgo-business-workbook`).
  Epic ID: `EXA-G{n}-{AREA}`. Issue ID: `EXA-G{n}-{AREA}-{seq:03d}`, sequência
  por (gate, área) — estável mesmo com inserções futuras.
- **Owner**: operação solo-founder — `Product Owner` para itens de decisão,
  `Execução assistida (Claude Code)` para itens de implementação já
  decidida.
- **Estimate**: horas (não story points), coerente com o modelo de
  capacidade de 25h/semana.
- **Source File / Source Commit**: todo issue rastreia o arquivo (e commit,
  quando aplicável) real que o gerou — nunca uma tarefa genérica como
  "revisar tudo" ou "integrar skill".

## Totais (calculados diretamente do CSV, não estimados de cabeça)

> Atualizado em **2026-07-28**: `EXA-G5-QA-001` foi marcado como
> **resolvido** (ver `13-AUDITORIA-RIGOROSA-2026-07-28.md` §2 — mudança
> arquitetural eliminou a corrida com `/icon.svg`, confirmada por execução
> real desta sessão), e o epic `GTM` foi adicionado com 6 issues novas em
> G4/G6/G7/G9 (ver `14-PLANO-GTM.md`).

- **Milestones**: 11 (G0–G10).
- **Issues**: 27 (21 originais + 6 do epic `GTM`).
- **Esforço total estimado**: 86 horas (72h do baseline original + 14h do
  epic `GTM`) — cobre auditoria, todas as decisões necessárias, e o
  trabalho já claramente escopável. **Não** cobre a implementação
  decorrente das decisões de G1/G2/G3/G7 ainda não tomadas (ex.: reativar
  autenticação, migrar backend de persistência, redesenhar a conexão do
  PLANGEN) — essas viram issues novas, com estimativa própria, assim que
  cada decisão for registrada.
- **Issues P0**: 8 — `EXA-G0-DOC-001`, `EXA-G1-BE-001`, `EXA-G2-BE-001`,
  `EXA-G3-SEC-001`, `EXA-G3-DATA-001`, `EXA-G7-DOC-001`, `EXA-G9-OPS-001`,
  `EXA-G7-GTM-001` (decisão de modelo de negócio).
- **Capacidade semanal considerada**: 25 horas.
- **Data proposta de lançamento**: 2026-08-14 (**PROPOSTA, desatualizada** —
  calculada a partir de 2026-07-24; hoje é 2026-07-28 e G2 segue em
  execução. Ver `13-AUDITORIA-RIGOROSA-2026-07-28.md` §3.5: recomendado
  rebaseline explícito no próximo fechamento de gate, não usar esta data
  como compromisso. Não é um compromisso aprovado; ver
  `01-ROADMAP-LANCAMENTO.md`).

## Caminho crítico (resumo)

```
G0 (hoje) → G1 (3 decisões: auth, persistência, MCP) → G2 (ciclo central +
decisão PLANGEN) → G3 (implementação das decisões de auth/persistência) →
G4 (regressão blog, rápido) → G5 (corrigir teste flaky) → G6 (beta fechado) →
G7 (jurídico/suporte + decisão workbook) → G8 (RC) → G9 (lançamento,
aprovação humana obrigatória) → G10 (operação contínua)
```

G1, G3 e G7 contêm decisões do dono do produto que bloqueiam a estimativa
precisa de tudo que vem depois — por isso o esforço de 72h é um **piso**, não
um teto.

## Limitação — Linear não conectado

Não há conector do Linear disponível nesta sessão (confirmado por busca de
tools). Por isso, mesmo após `APROVADO PARA LINEAR`, a criação direta de
milestones/issues no Linear só será possível depois que um conector for
adicionado (via configurações de conectores do claude.ai). Até lá, o
`02-BACKLOG-LINEAR.csv`/`.json` são os artefatos de importação manual — cada
coluna do CSV corresponde a um campo padrão de issue do Linear (Title,
Description, Priority, Status, Labels, Assignee, Estimate, Dates,
Milestone/Cycle).
