---
document_id: SPEC-FUNCTIONAL-AMES-001
version: "1.0"
status: PROPOSED
source: SRS-AMES-001
---
# Functional Spec — AMES

Descreve o comportamento funcional dos 5 modos sobre os 8 gates. Requisitos formais: `product/SRS.md`.

## Modos × Gates
| Modo | Gates típicos | Entrada | Saída |
|---|---|---|---|
| SPECIFY | G0–G4 | objetivo, fontes | contratos e specs (este pacote) |
| AUDIT | G6 | artefato existente | achados (`CT-FINDING`) + decisão |
| ADAPT | G5 | conteúdo + source/target_format | composição adaptada + registro de transformações |
| GENERATE | G5 | contratos + conteúdo | artefato + dados paralelos + manifest |
| PACKAGE | G7 | artefatos validados | bundle + manifest + checksums |

## Regras de fluxo
- Um gate por ciclo; nunca auto-avança (`FR-004`, `ADR-008`).
- Toda saída: exatamente uma `decision` + uma `next_action` (`FR-003`, `CT-OUTPUT`).
- Erros e decisões recomendadas: `contracts/error-taxonomy.yaml`.

## Entradas/Saídas
Validadas por `skill-input.schema.json` e `skill-output.schema.json`. Conteúdo por `content-model.schema.json`.
