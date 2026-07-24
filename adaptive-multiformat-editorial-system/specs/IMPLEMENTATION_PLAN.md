---
document_id: SPEC-IMPLPLAN-AMES-001
version: "1.0"
status: PROPOSED
---
# Implementation Plan — AMES

## Fase 0 — Contratos (esta entrega)
Governança, contratos, decisões, specs, templates, testes, exemplos, rastreabilidade, prompts. Sem código de app.

## Fase 1 — Validação de contratos
Rodar validador JSON Schema sobre fixtures e exemplos (`tests/`). Corrigir até 100% verde.

## Fase 2 — Referência de implementação (fora desta rodada)
Fonte modular (tokens estruturados → tokens.css; componentes com variantes; perfis de formato;
`@media print`/`@page`). HTML único só no build final (`ADR-005`).

## Fase 3 — P-2 (fora desta rodada)
Integrar pipeline externo PDF/X + preflight. Nunca prometer antes de existir (`PR-003`).

## Ordem de correção herdada (SRC-02 §6)
P0 (antes de imprimir): eliminar compressão de página, corrigir rodapé, corpo/contraste,
estados textuais, dados estruturados. P1 (antes de "adaptativo"): perfis, transformação por
componente, variantes, testar formatos. P2 (antes de automação): schema, relações, evidência, testes.
