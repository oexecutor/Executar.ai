---
document_id: ADER-INDEX-AMES-001
title: ADER — Architecture, Design and Editorial Record (índice unificado)
version: "1.0"
status: APPROVED_FOR_SKILL_DRAFT
---

# ADER — índice unificado

**ADER** (Architecture, Design and Editorial Record) é apenas a **convenção interna de
índice** usada por esta skill. Não é um tipo de decisão à parte:

- **ADR** — registro canônico de decisões **arquiteturais** (`decisions/adr/`).
- **EDR** — registro canônico de decisões **editoriais** (`decisions/edr/`).

Uma decisão aceita **não é silenciosamente alterada**: cria-se nova decisão e relaciona-se
por `supersedes`/`superseded_by` (`GOV-AMES-001 §8`).

## ADR — Arquitetura

| ID | Título | Status |
|---|---|---|
| ADR-001 | Conteúdo estruturado como fonte canônica | ACCEPTED |
| ADR-002 | Tokens independentes da plataforma, referenciados por ID | ACCEPTED |
| ADR-003 | Perfis de formato como objetos versionados | ACCEPTED |
| ADR-004 | Cinco comportamentos de transformação | ACCEPTED |
| ADR-005 | Fonte modular; bundle único apenas para distribuição | ACCEPTED |
| ADR-006 | Separação entre impressão de escritório (P-1) e profissional (P-2) | ACCEPTED |
| ADR-007 | Saída estruturada paralela ao artefato visual | ACCEPTED |
| ADR-008 | Execução por gate único | ACCEPTED |
| ADR-009 | Namespace `ACR-` para critério de aceitação (resolve colisão com `AC-`) | ACCEPTED |

## EDR — Editorial

| ID | Título | Status |
|---|---|---|
| EDR-001 | Uma conclusão dominante por superfície | ACCEPTED |
| EDR-002 | Prioridade P0–P4 e orçamento de conteúdo | ACCEPTED |
| EDR-003 | Contrato de autenticidade Swiss clássico | ACCEPTED |
| EDR-004 | Gramática narrativa de gráficos | ACCEPTED |
| EDR-005 | Gauges apenas para metas, capacidade ou limites | ACCEPTED |
| EDR-006 | Não reduzir fonte para resolver overflow | ACCEPTED |

## Cadeia de rastreabilidade

```text
OBJ → BR/JTBD → FR/NFR/ACC/PRINT/AI/SWISS → CT-* / componentes / tokens → ADR/EDR → ACR → TEST
```
