---
document_id: SPEC-PRINT-AMES-001
version: "1.0"
status: PROPOSED
canonical_for: [P-1 vs P-2]
source: SRC-01, SRC-05 §20
---
# Print & Export Spec — AMES

Decisão: `ADR-006`. Requisitos: `PRINT-001..006`.

## P-1 — Exportação de escritório
Navegador · `window.print()` · `@media print` · `@page` · escala 100% · margens · quebras ·
safe area. **Sem garantia de PDF/X.** Adequado a relatórios internos, propostas, testes.
Controles de interface **MUST** ser ocultados em `@media print` (`ACR-014`, EDS-042).

## P-2 — Produção profissional
PDF/X conforme requisito · CMYK · ICC · sangria · fontes incorporadas · 300 dpi · preflight ·
prova · imposição quando necessária. Pipeline externo, **não incluído** nesta skill.

## Regra dura
A skill **MUST NOT** declarar uma exportação de navegador como arquivo profissional pronto
para gráfica (`PR-003`, `PRINT-006`). Cartão físico (`card-85.60x53.98`) é `print_class: P-2`.
