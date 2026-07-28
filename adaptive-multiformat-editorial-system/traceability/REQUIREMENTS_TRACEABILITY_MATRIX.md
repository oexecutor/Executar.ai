---
document_id: RTM-AMES-001
version: "1.0"
status: PROPOSED
---

# Matriz de Rastreabilidade — AMES

Fonte de dados: `REQUIREMENTS_TRACEABILITY_MATRIX.csv`. Cadeia:
`OBJ → BR/JTBD → requisito → contrato → decisão → teste → ACR → evidência`.

## Regra verificada
Todo requisito **P0/P1** está ligado a **pelo menos um contrato, um teste e um critério de
aceitação** (e uma decisão quando aplicável). Verificação automatizada confirmou **0
lacunas** entre os 40 requisitos P0/P1 (script em `tests/`).

## Resumo por grupo

| Grupo | Qtde | P0 | P1 | P2 |
|---|---|---|---|---|
| FR | 7 | 6 | 1 | 0 |
| DR | 5 | 3 | 2 | 0 |
| NFR | 4 | 1 | 3 | 0 |
| ACC | 8 | 2 | 4 | 2 |
| PRINT | 6 | 4 | 2 | 0 |
| SEC | 3 | 2 | 1 | 0 |
| AI | 3 | 1 | 2 | 0 |
| SWISS | 6 | 1 | 5 | 0 |
| **Total** | **42** | **20** | **20** | **2** |

## Objetivos → requisitos

| Objetivo | Requisitos |
|---|---|
| OBJ-001 fonte única multiformato | FR-001, FR-002, DR-004 |
| OBJ-002 SCALE não compensa excesso | FR-007, EDR-006 |
| OBJ-003 P0/P1 nunca ocultos | DR-001, FR-007 |
| OBJ-004 governança epistemológica | DR-005, SEC-003, NFR-001 |
| OBJ-005 par visual+estruturado | FR-005, AI-001 |
| OBJ-006 Swiss auditável | SWISS-001..006 |
| OBJ-007 P-1 vs P-2 | PRINT-001, PRINT-005, PRINT-006 |
| OBJ-008 rastreabilidade | NFR-002, FR-006, AI-003 |

## Decisões → requisitos

| Decisão | Requisitos afetados |
|---|---|
| ADR-001 | FR-001, NFR-001 |
| ADR-002 | FR-001, NFR-004, SEC-003, SWISS-006 |
| ADR-003 | DR-004 |
| ADR-004 | FR-002, FR-007 |
| ADR-006 | PRINT-001, PRINT-005, PRINT-006 |
| ADR-007 | FR-005, DR-002, AI-001, NFR-001 |
| ADR-008 | FR-003, FR-004 |
| ADR-009 | NFR-002 |
| EDR-002 | DR-001 |
| EDR-003 | SWISS-001..006 |
| EDR-006 | FR-007, PRINT-002 |
