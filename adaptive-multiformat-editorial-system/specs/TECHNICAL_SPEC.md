---
document_id: SPEC-TECHNICAL-AMES-001
version: "1.0"
status: PROPOSED
source: SRC-01 §"Recomendação direta", SRC-05 §25
---
# Technical Spec — AMES

Esta skill entrega **contratos e specs**, não código de aplicação. A implementação de
referência (fora do escopo desta rodada) SHOULD seguir:

## Arquitetura recomendada (não normativa nesta versão)
- Fonte modular; HTML único apenas como artefato de distribuição (`ADR-005`).
- Tokens: fonte estruturada (DTCG-compatível) → gera `tokens.css` (`ADR-002`, `design-tokens-contract.yaml`).
- Responsividade: media queries (global) + container queries (widgets/previews).
- Impressão: `@media print` + `@page` (P-1); pipeline externo (P-2).

## Restrições (SRC-05 §25)
- MUST NOT gerar código de aplicação antes de concluir contratos.
- MUST NOT gerar HTML monolítico como fonte.
- MUST NOT inventar versões de bibliotecas nem assumir tecnologias externas disponíveis.
- Registrar limitações (`MANIFEST.yaml`, `references/SOURCES.md`).

## Validação
JSON Schema Draft 2020-12 para input/output/content/finding/decision. Testes em `tests/`.
