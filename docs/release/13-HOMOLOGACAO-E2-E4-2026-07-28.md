# Homologação operacional E2–E4 — 2026-07-28

Data da execução: **2026-07-28**

Publicação: `PUB-20260728-b4fbb3cc`

Status da publicação: **PUBLISHED**

## Decisão

- **E2 — APROVADA** para o fluxo GitHub → PR → Vercel Preview do mesmo SHA.
- **E3 — APROVADA** para esta publicação, com decisão humana explícita antes
  do merge.
- **E4 — APROVADA** para emissão e resolução técnica dos quatro tokens.
- **E5 — PENDENTE** de leitura física em celular e impressão real. Os arquivos
  A4/A6 foram gerados, mas a validação física não deve ser inferida do smoke
  HTTP.
- A EPIC #23 permanece aberta para E5, E6 e os demais critérios ainda não
  encerrados.

## Correção que removeu o bloqueio E2

O PR
[#38](https://github.com/oexecutor/P1.Executar.ai/pull/38) adicionou uma ponte
de evidência para execução por conectores quando tokens GitHub/Vercel não estão
disponíveis no runtime.

O servidor não confia em branch, SHA, PR ou URL informados pelo cliente. Antes
de avançar, ele verifica:

- repositório, base, branch, estado draft e SHA do PR público;
- Markdown, metadados, versão editorial e `content_hash`;
- presença do artigo, do `.meta.json` e da capa;
- SHA, branch, repositório, projeto e ambiente informados pelo próprio
  deployment Vercel;
- autenticação, permissão de escrita e `confirm=true`.

Commit de produção da correção:
`73a94392cf15df4ae5144737f0f6f79148b5a551`.

## Evidência E1

| Campo | Evidência |
|---|---|
| Gate | `PASSED` |
| Pontuação | `92/100` |
| Versão editorial | `1` |
| Hash | `13d89d65b4e22d3303b1ac95ad270620be9d7898c978748a3813cb8bd316d496` |
| DeskGo compatibility key | `APPLIED`, evidência interna `1.0.0` |
| Frankwatching compatibility key | `APPLIED`, evidência interna `1.0.0` |
| AMES compatibility key | `APPLIED`, evidência interna `1.0.0` |

As três chaves acima continuam identificadas honestamente como regras internas;
esta homologação não afirma execução das skills externas homônimas.

## Evidência E2

PR editorial:
[#39](https://github.com/oexecutor/P1.Executar.ai/pull/39)

Branch:
`editorial/pub-20260728-b4fbb3cc-homologacao-do-qr-semantico-p0`

SHA do pacote, dos dois Previews, da aprovação e da publicação:
`8ac77233569b75e53af7c117666f1cd571d983f8`

Artefatos:

- `content/blog/homologacao-do-qr-semantico-p0.md`;
- `content/blog/homologacao-do-qr-semantico-p0.meta.json`;
- `public/blog/homologacao-do-qr-semantico-p0/cover.svg`.

Deployments de Preview:

| Projeto | Deployment | Estado |
|---|---|---|
| `executar-ai` | `dpl_DropBygzyxxX5eDoKKfJUpV7BSoR` | `READY` |
| `executa-journal-preview` | `dpl_3LTtbksmwe7mqVA8AyVdkoZNMF5F` | `READY` |

O endpoint de evidência do Preview `executar-ai` confirmou:

- `commit_sha = 8ac77233569b75e53af7c117666f1cd571d983f8`;
- branch editorial exata;
- repositório `oexecutor/P1.Executar.ai`;
- `environment = preview`;
- projeto `prj_vA765A0ctnjhBILMEe9Mw5ClWuJu`.

## Evidência E3

A decisão `APPROVED` foi registrada para o SHA exato depois do smoke dos dois
Previews. O PR #39 foi integrado por fast-forward, preservando o SHA aprovado
como SHA da `main`.

Deployments produtivos:

| Projeto | Deployment | Estado |
|---|---|---|
| `executar-ai` | `dpl_2xQ9VHH6ot6Jp4XjSaBwQB1SgwJc` | `READY` |
| `executa-journal-preview` | `dpl_EVn38FSETDtAfUBYVzbSGJGk2dFm` | `READY` |

Artigo:
[`https://executa-journal-preview.vercel.app/blog/homologacao-do-qr-semantico-p0`](https://executa-journal-preview.vercel.app/blog/homologacao-do-qr-semantico-p0)

Nenhum erro de runtime foi encontrado nos dois projetos no período
pós-deploy.

## Evidência E4

Os quatro tokens estão `ACTIVE`:

| QR | Intenção | Política | Rota |
|---|---|---|---|
| QR-01 | Criar | `AUTHENTICATED_CONTEXT` | `https://executar-ai.vercel.app/q/qr_z1Ag1VwVUKwFdxWIg3PySsHI` |
| QR-02 | Preview | `PUBLIC_REDIRECT` | `https://executar-ai.vercel.app/q/qr_rkWf6RILbDhYC6oqiHkFzNXG` |
| QR-03 | Aprovar | `AUTHENTICATED_CONTEXT` | `https://executar-ai.vercel.app/q/qr_hF-QAxVI8csmdNflfdvVVb1U` |
| QR-04 | Medir | `AUTHENTICATED_CONTEXT` | `https://executar-ai.vercel.app/q/qr_ePutIGQ2_1egiUmfreul83eZ` |

Smoke:

- as quatro rotas responderam `302` para a intenção correta;
- os quatro endpoints `.svg` responderam com SVG válido;
- o QR de aprovação abriu contexto e não executou aprovação silenciosa;
- o QR de Preview resolveu o Preview registrado para o SHA aprovado.

## Testes executados

- `npm run env:check`;
- `npm run build`;
- `npm test` — **202/202**;
- `npm run lint`;
- `npm run build:web`;
- `npm run test:web` — **14/14**;
- `npm run lint:web`.

## Lacunas restantes

- leitura dos quatro QRs por câmera de celular real;
- impressão física A4 em escala 100% e teste de distância/iluminação;
- validação das zonas de corte/dobra exigidas por E5;
- conclusão do dashboard e dos critérios de E6;
- exercício operacional do rollback do artigo, apesar de o rollback técnico
  continuar disponível pelos deployments anteriores e por PR de reversão.

## Rollback

Em incidente:

1. reverter os três commits editoriais terminando em `8ac77233` por PR;
2. promover o deployment produtivo anterior do `executar-ai`
   (`dpl_F3JKM52VmqTkhaaR1wMV4LeLpXZ9`) e o anterior do Journal
   (`dpl_4nnL91KSQU2vGSFb27zNJduintL7`);
3. revogar os quatro tokens no registro E4 se o material não puder continuar
   ativo;
4. registrar a publicação como falha operacional sem apagar a trilha de
   auditoria.
