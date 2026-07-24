---
document_id: GOV-AMES-001
title: Contract Master & Source of Truth — AMES
version: "1.0"
status: APPROVED_FOR_SKILL_DRAFT
supersedes: null
---

# 1. Objeto

Governar a produção, validação e evolução dos artefatos do **Sistema Editorial Responsivo
e Adaptativo Multiformato (AMES)**. Este documento é a autoridade de precedência e de
rastreabilidade da skill.

# 2. Escopo

Aplica-se a interfaces digitais (mobile, desktop, widget, slide, dashboard), materiais
impressos (A4, livro 150×230 mm, panfleto 99×210 mm, cartão 85,60×53,98 mm), Business
Model Canvas, imagens 1:1/4:3/16:9, componentes, tokens, contratos, protótipos,
especificações e testes de conformidade.

# 3. Precedência canônica

Em caso de conflito, prevalece o item de menor número:

1. ADR/EDR aprovado e mais recente (`decisions/`);
2. este contrato (`GOV-AMES-001`);
3. SRS (`product/SRS.md`);
4. specs editoriais/design/acessibilidade/impressão/agente (`specs/`);
5. contratos e schemas (`contracts/`);
6. PRD (`product/PRD.md`);
7. fontes externas (`references/SOURCES.md`, incluindo SRC-04 de tokens);
8. exemplos (`examples/`).

Regra de não-duplicação (`RG-25`): nenhuma regra é escrita duas vezes. O documento mais
apropriado é a fonte canônica; os demais **referenciam por ID**.

# 4. Matriz de precedência por tema (fonte canônica → consumidores)

| Tema | Fonte canônica | Consumidores (referenciam por ID) |
|---|---|---|
| Pipeline conceitual, 5 comportamentos, densidade | `SRC-01` → `specs/EDITORIAL_SPEC.md` | `contracts/transformation-rules.yaml`, `content-budgets.yaml` |
| Erros concretos que motivam a skill | `SRC-02` → `contracts/error-taxonomy.yaml` | `contracts/acceptance-criteria.yaml`, `product/PRD.md` |
| Perfil Swiss e valores de token | `SRC-04` (`TOK-DESKGO-SWISS-001`) | `contracts/style-profiles.yaml`, `design-tokens-contract.yaml` |
| Estrutura obrigatória do pacote | `SRC-05` → este pacote | `MANIFEST.yaml`, `SKILL.md` |
| Layout wireframe DESK-OS (W1/W2/W3, família de formatos) | `SRC-06` (imagem padrão) | `examples/`, `contracts/format-profiles.yaml` |
| Contratos, schemas, IDs | este pacote (`contracts/`) | todos os `specs/` |

# 5. Modalidade normativa

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`. Regras marcadas como *default
configurável* usam `SHOULD` (ver `RISK-004`, `content-budgets.yaml`).

# 6. Gestão de status

Nenhum requisito nasce `APPROVED` quando deriva de interpretação visual, inferência do
agente, preferência de implementação ou benchmark externo não aprovado. Esses itens
iniciam como `PROPOSED` ou `PROVISIONAL`. Valores herdados de `SRC-04` permanecem
`PROVISIONAL` até validação na origem (`SEC-003`).

# 7. Controle de mudanças

Mudança em requisito/decisão `APPROVED` exige `CR` (Change Request — `templates/` do
SRC-04 pode ser reutilizado) contendo: motivo, item afetado, impacto, alternativa,
decisão, aprovador, data, artefatos a atualizar.

# 8. Regra de supersessão

ADR/EDR não é apagado. Ao ser substituído:

```yaml
status: SUPERSEDED
superseded_by: ADR-XXX   # ou EDR-XXX
```

# 9. Regra de implementação

Código, SVG, CSS, HTML ou layout **não substituem** a especificação. Implementação é
evidência de conformidade somente quando: referencia requisito, referencia token, possui
teste e não contradiz decisão aprovada.

# 10. Rastreabilidade das citações a SRC-02 (`Desing_erros.md`)

O problema (`PRD §3`) cita, por ID estável, achados de `SRC-02`. Espelho verificável:

| Achado SRC-02 | Tema | Reflexo em AMES |
|---|---|---|
| `EDS-001` | compressão em página única | `EDR-001`, `FM-002`, `OV-001` |
| `EDS-002` | ausência de P0–P4 | `EDR-002`, `CT-001` |
| `EDS-003` | comportamento não declarado por bloco | `TR-001`, `FR-002` |
| `EDS-004`/`EDS-015` | funções incompatíveis / sem foco | `EDR-001` |
| `EDS-007`/`EDS-012` | tipo pequeno / densidade | `EDR-006`, `TR-002` |
| `EDS-021`/`EDS-037` | estado depende de símbolo/cor | `AC-002`, `ACC-002` |
| `EDS-031` | visual não é contrato p/ agente | `AI-001`, `AI-002` |
| `EDS-041`/`EDS-042` | paginação artificial / impressão ≠ interface | `EDR-006`, `PR-*`, `PRINT-006` |

# 11. Regra de lacuna

Dados ausentes são registrados como `LAC-XXX` (catálogo em `references/SOURCES.md §4` e
`product/PRD.md §Riscos`). Lacunas ativas nesta versão: `LAC-006` (personas), `LAC-009`
(perfis sem amostra real), `LAC-FONT`, `LAC-COLOR`. Nenhuma é preenchida por invenção.
