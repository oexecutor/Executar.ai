# Registro histórico do PR #30 — não homologação da E2 oficial

Data do registro original: **2026-07-28**
Escopo real: **gate interno e proteção de transição do PR #30**
Status atual: **SUPERADO COMO HOMOLOGAÇÃO E2**

## Correção do registro

O registro anterior classificou o PR #30 como implementação e homologação da
“E2 — enriquecimento editorial”. A Issue #23 nunca definiu essa fase. A E2
oficial sempre foi GitHub + Vercel Preview.

As evidências do PR #30 permanecem válidas no seu alcance:

- testes de H1, H2, hash e evidência;
- invalidação `STALE` após edição;
- bloqueio de transições sem gate;
- dois deployments Vercel `READY` do código da correção;
- autorização humana daquele merge.

Elas **não comprovam**:

- criação automática de branch;
- escrita automática de artigo e assets;
- criação automática de PR;
- captura automática do Preview por SHA;
- `/blog/:slug` produzido pelo pacote da publicação.

## Decisão corrigida

O GO registrado autorizou o merge do PR #30, já ocorrido. Ele não encerra a
E2 da Issue #23 e não autoriza novo merge ou deploy de produção.

```text
Release editorial: NO-GO
Saída: E2 automática homologada ponta a ponta em Preview
Produção: não alterar nesta correção sem nova aprovação humana
```
