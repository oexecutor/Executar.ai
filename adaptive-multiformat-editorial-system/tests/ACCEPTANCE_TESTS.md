---
document_id: ACCTESTS-AMES-001
version: "1.0"
status: PROPOSED
---

# Acceptance Tests — AMES

Mapeia cada critério `ACR-*` (`contracts/acceptance-criteria.yaml`) a seu(s) teste(s) e ao
cenário Gherkin em `acceptance.feature`. Um critério é aceito quando o teste passa ou, se
não verificável sem render/código, é registrado como `NOT_VERIFIABLE`.

| ACR | Critério (resumo) | Testes | Gherkin |
|---|---|---|---|
| ACR-001 | corpo impresso legível a 100% | TEST-PRINT-01 | — |
| ACR-002 | nada toca o rodapé/corte | TEST-PRINT-03, TEST-PRINT-04 | — |
| ACR-003 | superfície executiva só P0/P1 | TEST-CONTENT-01, TEST-TR-04 | Repriorização preserva P0/P1 |
| ACR-004 | estados textuais, não símbolo/cor | TEST-A11Y-05 | Estado não depende só de cor |
| ACR-005 | ranking reproduzível | TEST-AI-04 | — |
| ACR-006 | relações estruturadas | TEST-CONTENT-04 | — |
| ACR-007 | recomendação com ação/owner/status | TEST-CONTENT-05, TEST-AUDIT-01 | — |
| ACR-008 | compreensível em escala de cinza | TEST-SWISS-06, TEST-A11Y-01 | Perfil Swiss sem decoração |
| ACR-009 | sem emoji para estado | TEST-A11Y-06 | — |
| ACR-010 | fonte JSON/CSV canônica paralela | TEST-AI-01 | Saída visual acompanha dados |
| ACR-011 | schema validável | TEST-SCHEMA-01, TEST-SCHEMA-02 | — |
| ACR-012 | saída perfilada p/ formatos P0 | TEST-FMT-01..04 | — |
| ACR-013 | aplica reflow/reprior/subst/pag | TEST-TR-03..06 | — |
| ACR-014 | impressão separada da interface | TEST-PRINT-05 | P-1 não é gráfica |
| ACR-015 | testado em 320px/desktop/print | TEST-A11Y-03 | — |
| ACR-016 | fato/inferência/lacuna/recomendação separados | TEST-EV-01 | — |
| ACR-017 | SCALE nunca p/ caber | TEST-TR-02 | SCALE não resolve overflow |
| ACR-018 | gauge só meta/capacidade/limite | TEST-CP-02 | — |
| ACR-019 | P-2 com PDF/X+preflight | TEST-PRINT-06 | P-1 não é gráfica |
| ACR-020 | uma decisão + uma ação | TEST-OUT-01 | Uma decisão e uma ação |
