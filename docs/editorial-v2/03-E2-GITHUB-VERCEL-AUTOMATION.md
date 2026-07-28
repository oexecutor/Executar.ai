# E2 — Automação GitHub e Vercel Preview

Epic: [Issue #23](https://github.com/oexecutor/P1.Executar.ai/issues/23)
Status: **IMPLEMENTADA EM BRANCH; NO-GO ATÉ HOMOLOGAÇÃO PONTA A PONTA**

## Fronteira entre E1 e E2

`READY_FOR_PREVIEW` significa que o pacote e o gate interno da E1 foram
concluídos para a versão e o hash atuais. A partir daí:

```text
POST /api/editorial/publications/:id/artifact/create
  { "confirm": true }
→ grava content/blog/<slug>.md
→ grava content/blog/<slug>.meta.json
→ grava public/blog/<slug>/cover.svg
→ cria/atualiza editorial/<publicationId>-<slug>
→ cria commit
→ cria ou reutiliza PR draft
→ PREVIEW_BUILDING

POST /api/editorial/publications/:id/preview/sync
→ consulta GET /v7/deployments por projectId + branch + SHA
→ ignora deployments de produção
→ exige meta.githubCommitSha idêntico
→ PREVIEW_READY | PREVIEW_FAILED | PREVIEW_BUILDING
```

O painel consulta `preview/sync` automaticamente enquanto o status for
`PREVIEW_BUILDING` e oferece atualização manual segura. Não existem campos
para branch, SHA, número do PR, URL ou deployment ID.

## Segurança e permissões

As credenciais ficam somente no servidor:

| Variável | Uso |
|---|---|
| `EDITORIAL_GITHUB_TOKEN` | token granular com `Contents: write` e `Pull requests: write` |
| `EDITORIAL_GITHUB_REPOSITORY` | repositório no formato `owner/name` |
| `EDITORIAL_GITHUB_BASE_BRANCH` | branch base, normalmente `main` |
| `EDITORIAL_VERCEL_TOKEN` | leitura dos deployments do projeto |
| `EDITORIAL_VERCEL_PROJECT_ID` | projeto que gera o Preview editorial |
| `EDITORIAL_VERCEL_TEAM_ID` | escopo do projeto |

Validação antes da homologação:

```bash
npm run env:check:editorial-e2
```

Se qualquer integração estiver ausente, os endpoints falham fechados com
`E2_GITHUB_NOT_CONFIGURED` ou `E2_VERCEL_NOT_CONFIGURED`. Tokens nunca são
retornados, registrados no objeto editorial ou enviados ao navegador.

## Idempotência

- a branch é determinística por publicação;
- uma tree idêntica reutiliza o commit existente;
- um PR aberto para a mesma branch é reutilizado;
- repetir `preview/sync` não cria deployment;
- mudança editorial zera artefato, Preview e aprovação;
- atualização de ref não usa `force`.

## Evidência obrigatória

`PREVIEW_BUILDING` exige:

- branch;
- commit SHA-1 completo;
- número e URL do PR;
- versão e hash aprovados na E1;
- `artifact_contract_version = "1.0"`;
- caminhos dos artefatos;
- timestamp da criação.

`PREVIEW_READY` acrescenta:

- deployment `dpl_…`;
- URL HTTPS imutável;
- timestamp do deployment;
- `preview.commit_sha == github.commit_sha`.

## Conteúdo no Preview

O build executa `scripts/generate-blog-content.mjs`. O script transforma cada
par `content/blog/<slug>.md` + `.meta.json` em dados tipados consumidos pelo
EXECUTA Journal. H1, H2, metadados ou pares ausentes reprovam o build.

## Teste de aceite da E2

1. configurar as seis variáveis apenas no ambiente Preview;
2. criar uma publicação descartável;
3. concluir a E1;
4. acionar “Criar artefato e iniciar Preview”;
5. confirmar branch, commit e PR draft automáticos;
6. aguardar `PREVIEW_READY`;
7. confirmar que PR e Preview têm o mesmo SHA;
8. abrir `/blog/:slug` e conferir título, seções e capa;
9. confirmar que nenhum merge ou deployment de produção ocorreu;
10. registrar evidências na Issue #23.

Até os dez passos passarem, a decisão permanece **NO-GO**.
