---
document_id: GLOSSARY-AMES-001
title: Vocabulário Controlado — AMES
version: "1.0"
status: APPROVED_FOR_SKILL_DRAFT
---

# Vocabulário controlado

Enums fechados. Qualquer valor fora destas listas é inválido (`IN-001`).

## Modos
`SPECIFY` · `AUDIT` · `ADAPT` · `GENERATE` · `PACKAGE`

## Gates
`G0` · `G1` · `G2` · `G3` · `G4` · `G5` · `G6` · `G7`

## Decisões de saída
`AVANÇAR` · `CORRIGIR` · `PAUSAR` · `ENCERRAR`

## Comportamentos de transformação
`SCALE` · `REFLOW` · `REPRIORITIZE` · `SUBSTITUTE` · `PAGINATE`

## Prioridade editorial
`P0` (obrigatório/bloqueador) · `P1` (decisão/mensagem principal) · `P2` (evidência) ·
`P3` (complemento) · `P4` (metodologia/apêndice)

## Classificação epistemológica
`FACT` · `EVIDENCE` · `INFERENCE` · `HYPOTHESIS` · `COUNTEREVIDENCE` · `GAP` · `RECOMMENDATION`

## Tipos de bloco de conteúdo
`heading` · `paragraph` · `metric` · `chart` · `table` · `callout` · `recommendation` ·
`evidence` · `source` · `action` · `canvas-block` · `code` · `image` · `qr`

## Representações
`full` · `compact` · `minimal` · `print` · `interactive` · `text_fallback`

## Variantes de componente
`full` · `compact` · `minimal` · `print` · `interactive`

## Formatos (todos P0 nesta versão)
`a4` · `book-150x230` · `pamphlet-99x210` · `widget` · `business-model-canvas` ·
`card-85.60x53.98` · `mobile` · `desktop` · `slide` · `image-1x1` · `image-4x3` · `image-16x9`

## Perfis de estilo
`neutral-editorial` · `classic-swiss-editorial` · `custom`

## Classe de impressão
`none` · `P-1` (escritório/navegador) · `P-2` (produção profissional)

## Densidade
`spacious` · `comfortable` · `compact` · `data-dense`

## Severidade de achado
`CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `INFO` · `NOT_VERIFIABLE`

## Certeza de achado
`CONFIRMED` · `INFERRED` · `NOT_VERIFIABLE`

## Status de decisão (ADR/EDR)
`PROPOSED` · `ACCEPTED` · `REJECTED` · `DEPRECATED` · `SUPERSEDED`

## Status de requisito/artefato
`PROPOSED` · `PROVISIONAL` · `APPROVED` · `SUPERSEDED` · `REJECTED`

## Relações entre objetos (grafo)
`DUPLICATES` · `EXTENDS` · `SUPERSEDES` · `INSTANCE_OF` · `SHARES_ENGINE_WITH` · `CONFLICTS_WITH` · `DERIVED_FROM` · `EVIDENCED_BY`

## Estados textuais normalizados (substituem símbolo/cor — `EDS-021`)
`ACCESSIBLE` · `ACCESSIBLE_WITH_WARNING` · `OUTSIDE_CONTAINER` · `MISSING` · `INVALID`

## Prefixos de ID
| Prefixo | Significado |
|---|---|
| `FR-` | requisito funcional |
| `DR-` | requisito de dados |
| `NFR-` | requisito não funcional |
| `ACC-` | requisito de acessibilidade |
| `PRINT-` | requisito de impressão |
| `SEC-` | requisito de segurança/governança |
| `AI-` | requisito de leitura/operação por agente |
| `SWISS-` | requisito de perfil Swiss clássico |
| `ADR-` | decisão de arquitetura |
| `EDR-` | decisão editorial |
| `CT-` | contrato |
| `ACR-` | critério de aceitação (namespace dedicado — `ADR-009`) |
| `AC-` | código de erro de acessibilidade na taxonomia (NÃO confundir com `ACR-`) |
| `LAC-` | lacuna |
| `RISK-` | risco |
| `TEST-` | caso de teste |
| `SRC-` | fonte |
