---
document_id: PRD-AMES-001
version: "0.2"
status: PROPOSED
source_contract: GOV-AMES-001
---

# PRD — Adaptive Multi-format Editorial System

## 1. Identificação

`name: adaptive-multiformat-editorial-system` · `display_name: Sistema Editorial Responsivo e Adaptativo Multiformato` · `type: contract-driven-editorial-skill` · `execution_model: single-gate` · `version: 1.0.0` · `language: pt-BR`.

## 2. Contexto

`FATO` — o usuário já opera sistemas contract-driven análogos (`DESKGO-SWISS-DESIGN-CONTRACT-SKILL` = SRC-04, e as skills `plano-operacional-rastreavel` / `desk-os-neurocompatible-projects`). Este PRD especifica um **motor genérico**, não amarrado a um produto específico, que qualquer um desses sistemas pode consumir para produzir saída em múltiplos formatos físicos e digitais a partir de uma única fonte de conteúdo.

## 3. Problema

`SRC-02` (`Desing_erros.md`) demonstrou, em caso concreto, que sem um sistema editorial multiformato formal: o conteúdo é comprimido até perder legibilidade (`EDS-001`, `EDS-007`, `EDS-012`); repriorização e paginação não acontecem (`EDS-002`, `EDS-041`); não há comportamento de transformação por componente (`EDS-003`); catálogo/auditoria/decisão/governança se misturam sem conclusão dominante (`EDS-004`, `EDS-015`); estados dependem de símbolo/cor sem rótulo textual (`EDS-021`, `EDS-037`); o visual não substitui dados estruturados para agentes (`EDS-031`); e impressão e interface não são separadas (`EDS-042`). Rastreabilidade completa em `01-GOVERNANCE/SOURCE-OF-TRUTH.md §10`.

## 4. Visão

Um **motor editorial com N saídas**, não N templates. Business Model Canvas, relatório, widget, panfleto, A4, livro, cartão, mobile, desktop, slide e imagens consomem o **mesmo** conteúdo, semântica, tokens e componentes, aplicando regras distintas de seleção, densidade, composição e representação.

## 5. Proposta de valor

- `necessidade` — publicar o mesmo conteúdo em muitos formatos sem recriá-lo nem perdê-lo silenciosamente.
- `solução proposta` — pipeline conteúdo→semântica→prioridade→perfil→transformação→variante→composição→validação→saída, orientado por contratos.
- `evidência` — os achados `EDS-*` de SRC-02 e o pipeline de SRC-01.
- `restrição` — não reduzir fonte para caber; P0/P1 nunca ocultos.

## 6. Usuários

`INFERÊNCIA` (`LAC-006` — não confirmado): Leonardo (Product Owner/operador); agentes de IA nos 5 modos; outras skills proprietárias consumidoras (não reimplementadoras); colaboradores/designers que revisam a saída; fornecedor gráfico quando P-2 é acionado.

## 7. Personas

- **Operador** — precisa de decisão e próxima ação por gate, sem ambiguidade.
- **Agente de IA** — precisa de dados estruturados, IDs e relações explícitas (sem OCR).
- **Revisor/designer** — precisa de saída auditável contra critério objetivo (Swiss).
- **Gráfica** — precisa de pacote P-2 com preflight, não export de navegador.

## 8. Jobs to Be Done

Ver `product/JTBD.md` (JTBD-001..004).

## 9. Objetivos

| ID | Objetivo |
|---|---|
| `OBJ-001` | Um único conteúdo gera saída coerente em **todos** os formatos P0 (A4, livro, panfleto, widget, dashboard, BMC, mobile, desktop, slide, cartão, imagens 1:1/4:3/16:9). |
| `OBJ-002` | Impedir que `SCALE` compense excesso de conteúdo. |
| `OBJ-003` | Todo bloco tem prioridade `P0`–`P4`; `P0`/`P1` nunca ocultos. |
| `OBJ-004` | Separar fato, evidência, inferência, hipótese, contraevidência, lacuna e recomendação. |
| `OBJ-005` | Produzir sempre par de saída: visual + dados estruturados paralelos. |
| `OBJ-006` | Perfil `classic-swiss-editorial` auditável objetivamente, reaproveitando tokens de `SRC-04` por ID. |
| `OBJ-007` | Separar impressão de escritório (P-1) de profissional (P-2). |
| `OBJ-008` | Rastreabilidade completa: todo `P0`/`P1` ligado a contrato, decisão, teste e evidência. |

## 10. Não objetivos

Identificação forense da fonte tipográfica; calibração profissional de cor; produção gráfica física; geração de aplicação real (React/HTML de produto); publicação externa.

## 11. Escopo MVP

`DECISÃO DO USUÁRIO (2026-07-22)` — **todos os formatos são P0**. O sistema é editorial completo tanto para produção gráfica quanto para design gráfico editorial. MVP totalmente detalhado inclui os 12 perfis de `format-profiles.yaml`. Perfis sem amostra real (BMC, cartão, slide) permanecem `PROVISIONAL` (`LAC-009`), mas são cobertos por perfil e orçamento.

## 12. Fora de escopo

Ver §10 e `SKILL.md §9`. Sem escrita externa; sem HTML monolítico como fonte.

## 13. Capacidades

SPECIFY, AUDIT, ADAPT, GENERATE, PACKAGE (`SKILL.md §3`), operando por gates G0–G7.

## 14. Fluxos

`content-sources` → G1 modelo semântico → G2 requisitos → G3 decisões → G4 contratos → G5 composição+dados paralelos → G6 auditoria → G7 pacote. Nunca auto-avança.

## 15. Formatos

12 perfis P0 em `contracts/format-profiles.yaml`.

## 16. Métricas de sucesso

Herdadas de `SRC-05 §41` (espelho em `contracts/quality-gates.yaml`): 100% dos `P0`/`P1` rastreados; 0 lacunas preenchidas por invenção; 5 comportamentos testáveis; todos os formatos P0 cobertos; Swiss com critério objetivo; P-1/P-2 separadas; saída sempre em par visual+estruturado.

## 17. Riscos

| ID | Risco | Mitigação |
|---|---|---|
| `RISK-001` | Orçamento tratado como regra rígida | Documentar como `default` configurável (`content-budgets.yaml`) |
| `RISK-002` | Colisão `AC-` (aceitação vs acessibilidade) | `ADR-009` — namespace `ACR-` |
| `RISK-003` | Perfis sem amostra real genéricos demais | `LAC-009`; validar com conteúdo antes de G5 real |
| `RISK-004` | Sistema burocrático trava produção | `SHOULD` onde a spec permite (`SRC-05 §41`) |
| `RISK-005` | Perfil Swiss diverge de `SRC-04` | `MUST` referenciar tokens por ID, nunca copiar (`ADR-002`) |

## 18. Hipóteses

`HYPOTHESIS` — as skills consumidoras adotarão o modelo de conteúdo sem reimplementar; os tokens de `SRC-04` são suficientes para o perfil Swiss.

## 19. Dependências

`SRC-04` (`TOK-DESKGO-SWISS-001`) para tokens; ambiente com validador JSON Schema Draft 2020-12; navegador para P-1; pipeline externo para P-2 (não incluído).

## 20. Critérios de lançamento

Ver `contracts/quality-gates.yaml → skill_ready_criteria`. Esta versão do PRD avança para `APPROVED` quando `LAC-006` for confirmado/aceito, a decisão de formatos-P0 for registrada (feito nesta versão) e `ADR-009` for aceita (feito).
