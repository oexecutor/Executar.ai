---
document_id: SOURCES-AMES-001
version: "1.0"
status: PROPOSED
---

# Fontes (SRC) e Lacunas (LAC)

## Fontes

| ID | Fonte | Tipo | Papel |
|---|---|---|---|
| `SRC-01` | `Sistema_Editorial_Responsivo_e_Adaptativo_Multiformato.md` | especificação conceitual | canônica: pipeline, 5 comportamentos, densidade, orçamento, gramática de gráficos |
| `SRC-02` | `Desing_erros.md` | auditoria de caso real (`EDS-001..047`) | canônica: taxonomia de erros, critérios de aceitação |
| `SRC-03` | `Swiss.md` (ANNEX-DESKGO-VISUAL-SWISS-001) | anexo de identidade | perfil Swiss (valores PROVISIONAL) |
| `SRC-04` | `DESKGO-SWISS-DESIGN-CONTRACT-SKILL-v1.0` (`TOK-DESKGO-SWISS-001`, `GOV-001`) | pacote contract-driven | **canônica de tokens** — referenciada por ID |
| `SRC-05` | `Full_especification.md` | missão/estrutura obrigatória | estrutura do pacote, regras de geração, §41 |
| `SRC-06` | imagem wireframe DESK-OS (W1/W2/W3, família de formatos) | referência raster | layout padrão de exemplos; regras de não-cópia |

## Regras de uso da referência visual (SRC-06)
`MAY` aproveitar: estrutura, densidade, hierarquia. `MUST NOT` copiar: identidade, textos,
logotipo, ilustrações. Valores extraídos de raster são `PROVISIONAL` (SRC-03 §1.2).

## Lacunas (LAC)

| ID | Lacuna | Estado |
|---|---|---|
| `LAC-006` | personas/usuários confirmados | INFERÊNCIA aceita nesta rodada |
| `LAC-009` | perfis sem amostra real (BMC, cartão, slide) | PROVISIONAL até validar com conteúdo |
| `LAC-FONT` | identificação forense da fonte tipográfica | fora de escopo; Roboto Condensed recomendada |
| `LAC-COLOR` | valores oficiais CMYK/ICC (P-2) | fora de escopo; exige calibração profissional |

## Herdadas de SRC-04 (`CONTRACT-MASTER §9`)
`LAC-001` nome exato da fonte · `LAC-002` valores colorimétricos oficiais · `LAC-003`
licença da fonte · `LAC-004` teste de contraste em dispositivos reais · `LAC-005` prova
física em escala de cinza. Permanecem abertas na origem; AMES as referencia, não as resolve.
