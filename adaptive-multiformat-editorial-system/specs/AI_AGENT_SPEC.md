---
document_id: SPEC-AI-AMES-001
version: "1.0"
status: PROPOSED
source: SRC-02 Cluster E
---
# AI Agent Spec — AMES

Requisitos: `AI-001..003`, `NFR-001`, `NFR-003`.

## Princípios
- Saída visual sempre acompanhada de dados estruturados paralelos (JSON/CSV) — sem OCR (`ADR-007`).
- Relações explícitas em campos, nunca em prosa (`AI-002`).
- Achados e blocos têm IDs globais estáveis, referenciáveis e encerráveis (`DR-003`, `AI-003`).
- Rankings/seleções determinísticos, reproduzíveis por score+evidência (`NFR-003`).
- Toda saída termina em uma decisão + uma próxima ação, legível por máquina (`CT-OUTPUT`).

## Como um agente consome a skill
1. Envia `skill-input.schema.json` (mode, gate, objective, formatos, fontes).
2. Recebe `skill-output.schema.json` com facts/evidence/…/findings/transformations/artifacts.
3. Cada artefato aponta `parallel_structured_data`. Sem interpretação visual implícita.
