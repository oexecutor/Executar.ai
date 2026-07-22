---
document_id: HANDOFF-AMES-001
version: "1.0"
status: FROZEN
gate: G4->G7
---

# Handoff Overview — AMES (G0→G7)

Visão congelada do pacote entregue. Fonte de precedência: `01-GOVERNANCE/SOURCE-OF-TRUTH.md`.

## O que foi entregue
- **Governança**: precedência canônica + vocabulário controlado.
- **Produto**: PRD (all-formats P0), SRS (42 requisitos, 40 P0/P1 totalmente rastreados), JTBD.
- **Specs**: editorial, funcional, técnico, design system, acessibilidade, impressão (P-1/P-2), agente, plano.
- **Decisões**: 9 ADR + 6 EDR + índice ADER.
- **Contratos**: 5 JSON Schemas (validados, Draft 2020-12) + 10 YAMLs.
- **Templates, Testes (Gherkin + fixtures validados), Exemplos (4, blocos validados), Rastreabilidade (CSV+MD), Prompts (4), Referências.**
- **MANIFEST.yaml** com checksums SHA-256 de todos os arquivos.

## Escopo confirmado com o usuário (2026-07-22)
1. Gerar o pacote completo (Lotes A–D).
2. **Todos os 12 formatos são P0** — sistema editorial completo para gráfica e design editorial.
3. Fonte canônica de tokens = pacote **DESKGO-SWISS-DESIGN-CONTRACT-SKILL-v1.0** (`TOK-DESKGO-SWISS-001`, SRC-04), referenciada por ID.

## Verificações executadas
- Schemas: well-formed (meta-schema OK).
- Fixtures: válidos passam, inválidos falham (CT-001/CT-002/IN-001).
- Exemplos: todos os blocos de conteúdo validam contra `content-model.schema.json`.
- Rastreabilidade: 0 lacunas entre os 40 requisitos P0/P1 (contrato + teste + ACR).

## Limitações e lacunas
Ver `MANIFEST.yaml → limitations` e `references/SOURCES.md`. Perfis BMC/cartão/slide
`PROVISIONAL` (LAC-009); tokens herdados `PROVISIONAL` (SEC-003); P-2 exige pipeline externo.

## Próximos passos sugeridos (fora desta entrega)
Fase 1 validação de contratos em CI; Fase 2 implementação de referência modular; Fase 3 pipeline P-2.
