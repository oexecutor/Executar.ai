# docs/release — Índice Mestre

Pacote de auditoria e planejamento de lançamento do **EXECUTA.AI**, gerado em
**2026-07-24** contra `origin/main` no commit `28a689ffee0fd87b31c8cbc59abda4c511c1edf1`.

> **Desambiguação obrigatória**: os gates **G0–G10** deste pacote são sobre
> **prontidão de lançamento público**. Eles **não são** os Gates 0–5 de
> `docs/GATE_PROGRESS.md`, que documentam a migração de backend DESK-OS
> (domínio → repositório → aplicação → MCP → API), concluída antes da
> migração Netlify→Vercel. Aquele histórico é um insumo do baseline deste
> novo G0, não um eixo paralelo.
>
> Este pacote também **supera** `docs/DEPLOYMENT_STATUS.md` (2026-07-19,
> alvo Netlify) — o ambiente real hoje é Vercel (`vercel.json`, projeto
> `executar-ai`).

## Documentos

1. [`00-STATUS-ATUAL.md`](./00-STATUS-ATUAL.md) — resumo executivo, tabela
   Área × Estado × Evidência × Bloqueio × Próxima ação, decisão recomendada.
2. [`01-ROADMAP-LANCAMENTO.md`](./01-ROADMAP-LANCAMENTO.md) — Gates G0–G10
   completos, incluindo as 3 skills revisadas e o handoff MCP como epics
   formais (§Fase F).
3. [`02-BACKLOG-LINEAR.csv`](./02-BACKLOG-LINEAR.csv) /
   [`.json`](./02-BACKLOG-LINEAR.json) /
   [`.md`](./02-BACKLOG-LINEAR.md) — backlog completo pronto para importar
   no Linear (prévia, nada foi criado no Linear ainda).
4. [`03-GATES-DE-RELEASE.md`](./03-GATES-DE-RELEASE.md) — critérios
   objetivos de passagem, com estado atual de cada um.
5. [`04-RISCOS-DECISOES.md`](./04-RISCOS-DECISOES.md) — registro de riscos e
   as 3 decisões necessárias do dono do produto.
6. [`05-CHECKLIST-LANCAMENTO.md`](./05-CHECKLIST-LANCAMENTO.md) — checklist
   completo por área, com evidência exigida.
7. [`06-PLANO-DE-TESTES.md`](./06-PLANO-DE-TESTES.md) — cobertura de testes
   real (o que já roda, o que é lacuna).
8. [`07-PLANO-DE-ROLLBACK.md`](./07-PLANO-DE-ROLLBACK.md) — procedimento de
   incidente e rollback.
9. [`08-OPERACAO-POS-LANCAMENTO.md`](./08-OPERACAO-POS-LANCAMENTO.md) —
   monitoramento, suporte, cadência de revisão pós-lançamento.

## Próxima ação única

Revisar `00-STATUS-ATUAL.md` e `04-RISCOS-DECISOES.md` e responder com uma
das seguintes:

- **`APROVADO PARA LINEAR`** — para eu sincronizar `02-BACKLOG-LINEAR.csv`/`.json`
  no Linear (sujeito à disponibilidade de um conector do Linear nesta sessão
  — hoje ausente, ver `02-BACKLOG-LINEAR.md` §Limitação).
- Uma decisão sobre qualquer uma das 3 **DECISÕES NECESSÁRIAS** em
  `04-RISCOS-DECISOES.md` (autenticação, persistência, duplicação de MCP).
- Pedido de ajuste em qualquer documento deste pacote antes da aprovação.

## Como este pacote foi gerado

Auditoria factual (build/test/lint/e2e locais + leitura direta de código),
classificando cada achado como FATO / EVIDÊNCIA / INFERÊNCIA / LACUNA /
BLOQUEIO / DECISÃO NECESSÁRIA — ver metodologia completa em
`00-STATUS-ATUAL.md`. Nenhum código de produto foi alterado nesta passada;
nenhuma tarefa foi criada no Linear; nenhum merge ou deploy foi feito.
