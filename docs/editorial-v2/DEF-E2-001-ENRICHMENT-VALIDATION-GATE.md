# DEF-E2-001 — Registro histórico e correção de classificação

Status: **RECLASSIFICADO; NÃO HOMOLOGA A E2 DA ISSUE #23**
Decisão de release: **NO-GO**

Este caminho é mantido para não quebrar links criados pelos PRs #30 e #32.
O documento anterior chamava o gate de qualidade de “E2 — enriquecimento
editorial”. Essa classificação contradizia a
[Issue #23](https://github.com/oexecutor/P1.Executar.ai/issues/23).

## O que o defeito comprovou

- O PR #29 avançou ao Preview com três pendências de qualidade.
- H1 e H2 eram apenas avisos.
- O cliente conseguia fornecer estados e evidências manualmente.
- O PR #30 corrigiu bloqueadores, hash, evidências e invalidação por mudança.

Essas correções continuam úteis, mas pertencem à **E1 — Intake e pacote
editorial**. Elas não criaram a E2 oficial.

## O que os validadores atuais realmente são

As chaves persistidas `deskgo`, `frankwatching` e `ames` executam regras
determinísticas internas do aplicativo:

| Chave de compatibilidade | Regra interna |
|---|---|
| `deskgo` | formato, hierarquia e densidade |
| `frankwatching` | clareza e estrutura |
| `ames` | conformidade estrutural e multiformato básica |

Elas **não executam** as skills Desk&Go, Frankwatching Editor ou AMES e não
podem ser apresentadas como parecer dessas dependências externas.

## Taxonomia oficial restaurada

```text
E0 — Contrato editorial e arquitetura
E1 — Intake e pacote editorial
E2 — GitHub e Vercel Preview
E3 — Aprovação e publicação
E4 — QR Router semântico
E5 — Impressão
E6 — Analytics e operação
```

## Saída válida do NO-GO

A E2 só pode ser homologada quando o painel executar, sem evidência digitada:

```text
pacote E1 aprovado
→ artigo + metadados + assets no repositório
→ branch por publicação
→ commit vinculado à versão e ao hash aprovados
→ PR draft
→ Vercel Preview não produtivo do mesmo SHA
→ /blog/:slug visível no Preview
```

O contrato técnico da correção está em
[`03-E2-GITHUB-VERCEL-AUTOMATION.md`](./03-E2-GITHUB-VERCEL-AUTOMATION.md).
