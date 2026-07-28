# DEF-E2-001 — Preview liberado sem execução dos adapters editoriais

Data: **2026-07-28**
Severidade: **P0**
Decisão de release: **NO-GO**

## Registro epistemológico

| Tipo | Registro |
|---|---|
| FATO | A versão anterior aceitava `PENDING`, `APPLIED` ou `FAILED` enviados pelo cliente em `POST /adapters`. |
| FATO | H1, H2 e adapters não aplicados eram avisos; somente erros tornavam `quality.valid=false`. |
| EVIDÊNCIA | O PR #29 foi criado com os três adapters em `PENDING` e o fluxo alcançou a etapa de Preview. |
| CONTRAEVIDÊNCIA | Pontuação editorial de 75/100 não prova que os requisitos obrigatórios foram executados. |
| DECISÃO | O PR #29 e seu artefato permanecem como evidência do defeito, não como homologação válida. |
| DECISÃO | Nenhum release é aprovado antes da correção E2 e da proteção server-side de `preview/start`. |

## Resultado esperado

DeskGo, Frankwatching e AMES são executados entre a edição do conteúdo e o
registro do artefato GitHub. Cada execução registra versão do adapter, versão
da publicação, SHA-256 do conteúdo, horários, achados, referência da saída e
ator. O gate final só libera `READY_FOR_PREVIEW` quando as três evidências
correspondem ao conteúdo atual.

## Resultado observado

A publicação avançou com os três adapters em `PENDING`. O gate tratou as
pendências como avisos, e `preview/start` não revalidou o gate, as evidências,
a versão ou o hash antes de registrar branch e commit.

## Impacto

Conteúdo podia alcançar GitHub e Vercel Preview sem o enriquecimento e a
validação prometidos pelo produto. Uma pontuação alta também poderia mascarar
o descumprimento de um requisito obrigatório.

## Correção

- adiciona `CONTENT_READY`, `ENRICHING`, `ADAPTERS_APPLIED` e `ADAPTER_FAILED`;
- substitui etiquetas manuais por execução real e auditável dos três adapters;
- usa `NOT_RUN`, `RUNNING`, `APPLIED`, `FAILED`, `STALE` e `SKIPPED`;
- torna H1, H2, conteúdo mínimo e briefing completo bloqueadores;
- separa gate técnico de pontuação editorial;
- transforma execuções anteriores em `STALE` quando o conteúdo muda;
- protege `preview/start` com estado, gate, evidências, versão, SHA-256 e data;
- vincula o artefato GitHub à versão e ao hash aprovados;
- exige URL imutável e deployment ID para concluir o Preview.

## Critérios de saída do NO-GO

1. adapter não executado impede o gate e o Preview;
2. adapter falho impede o gate e o Preview;
3. `APPLIED` sem evidência é recusado ou convertido para `STALE`;
4. alteração de conteúdo invalida as três execuções;
5. H1 ausente bloqueia E2;
6. H2 ausente bloqueia E2;
7. chamada direta a `preview/start` falha sem E2;
8. três adapters com evidência liberam o gate final;
9. hash do gate corresponde ao conteúdo e ao registro GitHub;
10. commit revisado e publicado permanece o mesmo commit aprovado.

## Rollback

Reverter o commit da correção e a aplicação da migration
`202607280001_editorial_e2.sql`. A migration é expansiva e não exclui dados;
em rollback de aplicação, registros com os novos estados devem permanecer
somente leitura até o runtime E2 ser restaurado.
