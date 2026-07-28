# Adaptação — Relatório Executivo

## A4 (comfortable, orçamento: 12 métricas / 4 gráficos)
- Cabe no orçamento. Comportamento: **REFLOW** (2 colunas → título+resumo | métrica+gráfico).
- Tabela de coortes (P3) mantida na página; nota de fonte (P2) ao pé.

## Widget (spacious, orçamento: 1 métrica / 35 palavras)
- Excede. Ordem de overflow aplicada:
  - **REPRIORITIZE**: mantém P1 (MET-mrr, REC-expand → vira "próxima ação"); oculta P3 (tabela).
  - **SUBSTITUTE**: MET-mrr full(chart) → minimal(KPI + tendência).
- Nada de P0/P1 oculto. Fonte preservada como tooltip.

## Registro de transformações
| block_id | from | to | behavior | justificativa | impacto |
|---|---|---|---|---|---|
| MET-mrr | a4 | widget | SUBSTITUTE | container estreito | gráfico → KPI+tendência |
| TAB-cohorts | a4 | widget | REPRIORITIZE | P3 fora do orçamento | movido para expansão/QR |
