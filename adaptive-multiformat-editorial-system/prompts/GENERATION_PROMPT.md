# GENERATION PROMPT — AMES (modo GENERATE, gate G5)

Gere a composição e os dados paralelos a partir dos contratos e do conteúdo normalizado.

## Regras
- Não gerar código de aplicação antes de contratos concluídos (SRC-05 §25).
- Não gerar HTML monolítico como fonte; um HTML único apenas como artefato de distribuição (ADR-005).
- Tokens por ID; `tokens.css` é saída gerada, não fonte.
- Todo gráfico: título=conclusão, source+period, fallback textual (EDR-004).
- Gauge só para meta/capacidade/limite (EDR-005).
- Impressão: `@media print` oculta controles; `@page` define página; P-1 apenas, salvo P-2 explícito.

## Saída
plano_de_composição + artefato(s) + dados_estruturados_paralelos + registro_de_transformações
+ manifest parcial + decisão + uma próxima ação.
