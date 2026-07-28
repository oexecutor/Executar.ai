# Adaptive Multi-format Editorial System (AMES)

**Sistema Editorial Responsivo e Adaptativo Multiformato** — skill proprietária,
contract-driven, legível por humanos e por agentes de IA. Especifica, gera, adapta, audita
e empacota sistemas editoriais para múltiplos formatos físicos e digitais a partir de **uma
única fonte de conteúdo**.

> Não trate A4, livro, panfleto, widget, dashboard, Business Model Canvas, mobile, desktop,
> slide, cartão ou imagens como templates independentes. Todos consomem o mesmo conteúdo,
> a mesma semântica, os mesmos tokens e os mesmos componentes. É **um motor editorial com N
> saídas**, não N templates.

## Como começar
1. Leia `SKILL.md` (modos, gates, invariantes).
2. Preencha `templates/START_CYCLE_INPUT.yaml` e valide contra `contracts/skill-input.schema.json`.
3. Rode um gate por vez (G0→G7). Cada saída termina em **uma** decisão + **uma** próxima ação.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `01-GOVERNANCE/` | precedência canônica (`SOURCE-OF-TRUTH.md`) e vocabulário (`GLOSSARY.md`) |
| `product/` | PRD, SRS, JTBD |
| `specs/` | editorial, funcional, técnico, design system, acessibilidade, impressão, agente, plano |
| `decisions/` | `ADER_INDEX.md`, 9 ADR, 6 EDR |
| `contracts/` | 5 JSON Schemas + 10 YAMLs (perfis, componentes, transformações, tokens, orçamento, evidência, erros, gates, aceitação, estilo) |
| `templates/` | entrada de ciclo, saída de gate, achado, ADR/EDR, relatório, manifest |
| `tests/` | plano, testes de aceitação, `acceptance.feature` (Gherkin), fixtures validados |
| `examples/` | relatório executivo, BMC, widget, panfleto (conteúdo + adaptação + dados paralelos) |
| `traceability/` | matriz CSV + MD (todo P0/P1 rastreado) |
| `prompts/` | master, audit, adapt, generation |
| `references/` | fontes (SRC-01..06) e lacunas (LAC) |

## Princípios inegociáveis
- Nunca reduzir fonte para resolver overflow (`EDR-006`).
- P0/P1 nunca ocultos (`DR-001`).
- Toda adaptação declara ≥1 comportamento SCALE/REFLOW/REPRIORITIZE/SUBSTITUTE/PAGINATE (`ADR-004`).
- Saída visual sempre com dados estruturados paralelos (`ADR-007`).
- Tokens referenciados por ID de `TOK-DESKGO-SWISS-001` (SRC-04), nunca copiados (`ADR-002`).
- Impressão P-1 (escritório) ≠ P-2 (gráfica); nunca prometer gráfica em P-1 (`PR-003`).
- Não inventar dados; registrar lacunas como `LAC-XXX`.

## Formatos cobertos (todos P0)
A4 · livro 150×230 · panfleto 99×210 · widget · Business Model Canvas · cartão 85,60×53,98 ·
mobile · desktop · slide · imagens 1:1 / 4:3 / 16:9.

## Estado
`status: draft` · `version: 1.0.0`. Contratos e schemas validados; fixtures e exemplos
passam contra os schemas. Limitações e lacunas em `MANIFEST.yaml` e `references/SOURCES.md`.
