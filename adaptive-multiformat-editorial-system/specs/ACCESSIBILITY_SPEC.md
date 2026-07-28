---
document_id: SPEC-A11Y-AMES-001
version: "1.0"
status: PROPOSED
source: SRC-01 §19, SRC-02 Cluster F
---
# Accessibility Spec — AMES

Requisitos formais: `product/SRS.md` (ACC-001..008). Códigos de erro: `AC-001`, `AC-002`.

## Cobertura
- Contraste (ACC-001) e legibilidade em escala de cinza (SWISS-004).
- Não depender só de cor (ACC-002); estados textuais normalizados (`GLOSSARY`: ACCESSIBLE, MISSING…).
- Reflow 320px (ACC-003); zoom 200% (ACC-004); reduced motion (ACC-008).
- Navegação por teclado, foco visível, landmarks, hierarquia de headings.
- Nomes acessíveis; ícones com rótulo (ACC-006).
- Alternativa textual para todo gráfico; **alternativa linear** para estruturas
  bidimensionais — Business Model Canvas (ACC-005).
- Tabelas semânticas (ACC-007); ordem de leitura previsível.

## Verificação
Testes: `TEST-A11Y-01..09`. Itens não verificáveis sem código são marcados `NOT_VERIFIABLE` (SRC-02 §3).
