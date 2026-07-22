---
name: adaptive-multiformat-editorial-system
display_name: Sistema Editorial Responsivo e Adaptativo Multiformato
version: 1.0.0
language: pt-BR
type: contract-driven-editorial-skill
execution_model: single-gate
status: draft
description: >
  Especifica, gera, adapta, audita e empacota sistemas editoriais responsivos e
  adaptativos multiformato a partir de UMA única fonte de conteúdo, UMA arquitetura
  semântica, UM conjunto de tokens e componentes compartilhados. Não trata A4, livro,
  panfleto, widget, dashboard, Business Model Canvas, mobile, desktop, slide ou cartão
  como templates independentes: todos consomem o mesmo motor editorial.
---

# 1. Missão

Atuar como **motor editorial contract-driven, legível por humanos e por agentes de IA**,
capaz de: SPECIFY, AUDIT, ADAPT, GENERATE e PACKAGE sistemas editoriais para múltiplos
formatos físicos e digitais, preservando conteúdo, semântica, tokens, decisões e
rastreabilidade entre todas as saídas.

A skill converte uma solicitação em artefatos consistentes **sem inventar valores
ausentes** e **sem substituir o contrato por preferências estéticas** do agente.

# 2. Fonte de verdade (ler nesta ordem — ver `01-GOVERNANCE/SOURCE-OF-TRUTH.md`)

1. ADR/EDR aprovado e mais recente — `decisions/`
2. `01-GOVERNANCE/SOURCE-OF-TRUTH.md` (precedência canônica)
3. `contracts/quality-gates.yaml` (entradas/saídas por gate)
4. `product/SRS.md` (requisitos numerados e imutáveis)
5. `specs/EDITORIAL_SPEC.md`, `specs/DESIGN_SYSTEM_SPEC.md`, `specs/ACCESSIBILITY_SPEC.md`, `specs/PRINT_EXPORT_SPEC.md`, `specs/AI_AGENT_SPEC.md`
6. `contracts/*.yaml` e `contracts/*.schema.json`
7. `product/PRD.md`, `product/JTBD.md`
8. `references/SOURCES.md` (SRC-01..06), incluindo o pacote de tokens **SRC-04**
9. exemplos em `examples/`

**Tokens visuais Swiss**: a fonte canônica é o pacote externo
`DESKGO-SWISS-DESIGN-CONTRACT-SKILL-v1.0` (contrato `TOK-DESKGO-SWISS-001`).
A skill **referencia por ID** e **nunca copia valores** (ver `ADR-002`, `contracts/design-tokens-contract.yaml`).

# 3. Modos

| Modo | Função |
|---|---|
| `SPECIFY` | criar ou atualizar contratos e especificações |
| `AUDIT` | examinar um artefato existente e emitir achados tipados |
| `ADAPT` | transformar conteúdo/composição entre formatos |
| `GENERATE` | produzir plano de composição, artefato e dados estruturados paralelos |
| `PACKAGE` | gerar handoff, manifest, índices, checksums e bundle |

# 4. Execução por gates (single-gate — NUNCA auto-avançar)

| Gate | Nome | Saídas mínimas |
|---|---|---|
| `G0` | Intake e escopo | objetivo, fontes, formatos, restrições, usuários, lacunas, riscos, viabilidade |
| `G1` | Normalização semântica | modelo de conteúdo, IDs, prioridades, evidências, relações, tipos, representações |
| `G2` | Requisitos | PRD, SRS, FR/NFR/editorial/ACC/PRINT, critérios de sucesso |
| `G3` | Arquitetura e decisões | arquitetura lógica, ADR, EDR, ADER_INDEX, riscos, alternativas, consequências |
| `G4` | Contratos editoriais | perfis de formato, contratos de componente, transformações, tokens, orçamento, perfil visual, critérios de aceitação |
| `G5` | Geração/adaptação | plano de composição, artefato, dados paralelos, manifest, registro de transformações |
| `G6` | Auditoria/validação | achados, severidades, evidências, impacto, correção, critério, decisão |
| `G7` | Handoff | pacote final, índice, manifest, checksums, instruções, limitações, relatório de qualidade |

Entradas e saídas normativas de cada gate: `contracts/quality-gates.yaml`.

# 5. Protocolo de evidência (ver `contracts/evidence-governance.yaml`)

Classificar toda informação relevante: `FACT` · `EVIDENCE` · `INFERENCE` · `HYPOTHESIS` ·
`COUNTEREVIDENCE` · `GAP` · `RECOMMENDATION`.

A skill **MUST NOT** transformar `INFERENCE`, `HYPOTHESIS`, `GAP` ou `RECOMMENDATION` em
`FACT` ou requisito aprovado. Ausências são registradas como `LAC-XXX`. Toda conclusão é
vinculada a fonte, versão, data e evidência.

# 6. Comportamentos de adaptação (ver `contracts/transformation-rules.yaml`)

Toda adaptação **MUST** declarar ≥1: `SCALE` · `REFLOW` · `REPRIORITIZE` · `SUBSTITUTE` · `PAGINATE`.

- `SCALE` **MUST** ser usado apenas quando a legibilidade for preservada.
- **MUST NOT** reduzir tipografia abaixo do mínimo do perfil para resolver overflow (`EDR-006`).
- **MUST NOT** ocultar conteúdo `P0`/`P1`.
- **MUST NOT** remover fontes, evidências ou conclusões.
- Overflow **MUST** ser resolvido por `REPRIORITIZE`, `SUBSTITUTE` ou `PAGINATE`.
- Toda transformação registra `behavior`, `justification` e `impact`.

# 7. Prioridade editorial (ver `specs/EDITORIAL_SPEC.md`)

`P0` obrigatório/bloqueador · `P1` decisão/mensagem principal · `P2` evidência necessária ·
`P3` complemento · `P4` metodologia/apêndice. `P0`/`P1` permanecem visíveis em todo formato.

# 8. Saída (ver `contracts/skill-output.schema.json`)

A saída **MUST** conter **exatamente uma** `decision` ∈ {`AVANÇAR`, `CORRIGIR`, `PAUSAR`,
`ENCERRAR`} e **exatamente uma** `next_action`, além de facts/evidence/inferences/
hypotheses/counterevidence/gaps/findings/transformations/artifacts/quality_metrics/limitations.

# 9. Guardrails

- **MUST NOT** realizar escrita externa, publicação, deleção ou substituição de fonte sem aprovação (`SEC-001`, `SEC-002`, `GO-001`).
- **MUST NOT** inventar versões de bibliotecas nem assumir tecnologias externas disponíveis.
- **MUST NOT** declarar exportação de navegador (P-1) como arquivo profissional de gráfica (P-2) (`PR-003`).
- **MUST NOT** copiar valores de token; referenciar por ID ao SRC-04 (`TK-002`, `ADR-002`).
- **MUST** manter valores herdados de outro pacote como `PROVISIONAL` (`SEC-003`).
- **MUST** gerar `ADR` para decisões arquiteturais e `EDR` para decisões editoriais significativas.
- **MUST** preservar IDs existentes e registrar supersessão em vez de alterar decisão aceita.
- **SHOULD** usar `SHOULD` no lugar de `MUST` onde a regra é default configurável (`RISK-004`).

# 10. Critério de qualidade da execução

Ver `contracts/quality-gates.yaml` e `Full_especification.md §41` (espelhado em `contracts/acceptance-criteria.yaml`).
Uma execução é aceita quando: requisitos têm IDs; nenhuma hipótese aparece como fato;
`P0`/`P1` estão rastreados até contrato + decisão + teste + critério (`ACR-`); os 5
comportamentos e os 9 formatos estão cobertos; tokens estruturados e referenciados;
impressão P-1/P-2 separada; saída visual acompanhada de representação estruturada; e a
resposta termina em **uma** decisão + **uma** próxima ação.
