---
document_id: SPEC-DESIGN-AMES-001
version: "1.0"
status: PROPOSED
canonical_for: [tokens (referência), perfil Swiss]
source: SRC-03, SRC-04
---
# Design System Spec — AMES

## Tokens
Contrato: `contracts/design-tokens-contract.yaml`. Camadas: primitives, semantic,
component, format, theme, print, data-visualization. Fonte canônica de valores:
`TOK-DESKGO-SWISS-001` (SRC-04), referenciada por ID — nunca copiada (`ADR-002`, `TK-002`).

## Perfil Swiss clássico
Contrato: `contracts/style-profiles.yaml → classic-swiss-editorial`. Decisão: `EDR-003`.
Critérios objetivos de auditoria: `AUD-SWISS-*`. Requisitos: `SWISS-001..006`.

## Paridade de tema
Light/Dark com mesma hierarquia, ordem, espaçamento, dimensões e significado do accent
(`SRC-03 §8`). Print e high-contrast como temas adicionais.

## Componentes
Contrato: `contracts/component-contracts.yaml`. Variantes mínimas: full/compact/minimal/print/interactive.
