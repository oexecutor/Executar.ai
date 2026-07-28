# DEF-E2-001 — Registro do defeito e reclassificação

Data original: **2026-07-28**
Severidade original: **P0**
Decisão atual: **NO-GO PARA A E2 OFICIAL**

## Evidência preservada

| Tipo | Registro |
|---|---|
| FATO | O PR #29 avançou ao Preview com três pendências registradas. |
| FATO | H1, H2 e pendências de qualidade eram avisos. |
| EVIDÊNCIA | A pontuação 75/100 não comprovava requisitos obrigatórios. |
| DECISÃO | O PR #29 permanece evidência do defeito, não homologação. |
| CORREÇÃO | O PR #30 adicionou gate, hash, evidência e invalidação. |
| RECLASSIFICAÇÃO | O gate do PR #30 pertence à E1, não à E2 da Issue #23. |

## Limite da correção do PR #30

Os runners locais associados às chaves `deskgo`, `frankwatching` e `ames`
são regras internas determinísticas. Eles não executam as skills homônimas.
Seus estados e evidências continuam úteis para fechar o pacote da E1.

## E2 oficial pendente

A Issue #23 define E2 como:

```text
branch por publicação
→ artigo e assets
→ PR
→ captura do Vercel Preview
→ Preview exibido no painel
```

A saída do NO-GO exige teste ponta a ponta dessa sequência, sem branch, SHA,
PR, URL ou deployment digitados pelo cliente. O Preview deve corresponder ao
mesmo commit e nunca ser um deployment de produção.

O plano atualizado está em
[`../editorial-v2/03-E2-GITHUB-VERCEL-AUTOMATION.md`](../editorial-v2/03-E2-GITHUB-VERCEL-AUTOMATION.md).
