---
document_id: TESTPLAN-AMES-001
version: "1.0"
status: PROPOSED
---

# Test Plan — AMES

Cobre contratos, conteúdo, transformação, formatos, acessibilidade, impressão, perfil Swiss
e leitura por agente. IDs de teste `TEST-*` são referenciados por requisitos e critérios (`ACR-*`).

## 1. Contratos (schema)
| ID | Verifica |
|---|---|
| TEST-SCHEMA-01 | input válido valida contra `skill-input.schema.json` |
| TEST-SCHEMA-02 | output válido valida contra `skill-output.schema.json` |
| TEST-SCHEMA-03 | ID duplicado é rejeitado (DR-003) |
| TEST-SCHEMA-INVALID | enum inválido / required ausente são rejeitados (IN-001/IN-002) |

## 2. Conteúdo
| ID | Verifica |
|---|---|
| TEST-CONTENT-01 | bloco sem `priority` é rejeitado (CT-001) |
| TEST-CONTENT-02 | bloco sem `representations`/`text_fallback` é rejeitado (CT-002) |
| TEST-CONTENT-04 | relação em prosa é reprovada; deve estar em `relationships` (AI-002) |
| TEST-CONTENT-05 | recomendação sem `action` é rejeitada |
| TEST-EV-01 | fato/inferência/lacuna/recomendação permanecem separados (SEC-003) |

## 3. Transformação
| ID | Verifica |
|---|---|
| TEST-TR-01 | adaptação sem behavior declarado é reprovada (TR-001) |
| TEST-TR-02 | SCALE para caber / reduzir fonte é reprovado (TR-002, EDR-006) |
| TEST-TR-03 | REFLOW válido (desktop→mobile) |
| TEST-TR-04 | REPRIORITIZE preserva P0/P1 |
| TEST-TR-05 | SUBSTITUTE preserva informação e fonte |
| TEST-TR-06 | PAGINATE em overflow em vez de comprimir |

## 4. Formatos
| ID | Verifica |
|---|---|
| TEST-FMT-01 | A4 respeita orçamento e margens |
| TEST-FMT-02 | livro 150×230 mm |
| TEST-FMT-03 | panfleto 99×210 mm (proíbe SCALE) |
| TEST-FMT-04 | widget 320px (container queries) |
| TEST-FMT-05 | BMC tem alternativa linear (ACC-005) |
| TEST-FMT-06 | cartão 85,60×53,98 é print_class P-2 |

## 5. Acessibilidade
| ID | Verifica |
|---|---|
| TEST-A11Y-01 | contraste adequado (ACC-001) |
| TEST-A11Y-03 | reflow 320 CSS px (ACC-003) |
| TEST-A11Y-04 | zoom 200% (ACC-004) |
| TEST-A11Y-05 | estados textuais, não só cor (ACC-002) |
| TEST-A11Y-06 | ícones com rótulo; sem emoji-significado (ACC-006) |
| TEST-A11Y-07 | BMC linear |
| TEST-A11Y-08 | tabela semântica |
| TEST-A11Y-09 | reduced motion |

## 6. Impressão
| ID | Verifica |
|---|---|
| TEST-PRINT-01 | escala 100% legível (PRINT-002) |
| TEST-PRINT-03 | safe area / rodapé (PRINT-003) |
| TEST-PRINT-04 | break-inside (PRINT-004) |
| TEST-PRINT-05 | controles ocultos em @media print (PRINT-006) |
| TEST-PRINT-06 | P-2 exige PDF/X+CMYK+ICC+sangria+preflight (PRINT-005) |

## 7. Perfil Swiss
| ID | Verifica |
|---|---|
| TEST-SWISS-01 | grid/baseline |
| TEST-SWISS-02 | alinhamento à esquerda / borda irregular |
| TEST-SWISS-03 | ≤3 pesos, ≤4 níveis |
| TEST-SWISS-04 | sem pills/emoji/sombra/gradiente/glass |
| TEST-SWISS-05 | 1 papel semântico por cor; accent ≤5% |
| TEST-SWISS-06 | legível em preto e branco |

## 8. Agente / Governança / Saída
| ID | Verifica |
|---|---|
| TEST-AI-01 | artefato tem par estruturado (AI-001) |
| TEST-AI-04 | ranking reproduzível (NFR-003) |
| TEST-AUDIT-01 | achado tem id/severity/certainty/correção/ACR |
| TEST-TOKEN-01 | nenhum valor hard-coded; refs por ID (TK-002) |
| TEST-TRACE-01 | todo P0/P1 ligado a contrato+decisão+teste+ACR |
| TEST-GOV-01 | ação externa sem aprovação é bloqueada (GO-001) |
| TEST-GOV-02 | não substitui/apaga fonte (SEC-002) |
| TEST-OUT-01 | saída tem exatamente uma decisão + uma próxima ação (FR-003) |
| TEST-PKG-01 | manifest com checksums e limitações |

## Ambiente
Validador JSON Schema Draft 2020-12 sobre `tests/fixtures/`. Itens não verificáveis sem
render/código são marcados `NOT_VERIFIABLE` (SRC-02 §3), não aprovados nem reprovados.
