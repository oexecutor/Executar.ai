# DEF-E2-001 — Enriquecimento e validação editorial antes do Preview

> [!CAUTION]
> **STATUS DE RELEASE: NO-GO.** O Preview não pode ser considerado homologado enquanto DeskGo, Frankwatching e AMES puderem permanecer `PENDING` sem bloquear o avanço. Esta correção é obrigatória antes do lançamento.

## 1. Problema identificado

A rodada de homologação mostrou que a publicação pode avançar para o registro do artefato GitHub e para o Preview mesmo com os três adapters editoriais ainda pendentes.

O comportamento atual é inconsistente porque:

- DeskGo, Frankwatching e AMES começam como `PENDING`;
- o gate registra essas pendências apenas como avisos;
- avisos reduzem a pontuação, mas não reprovam o gate técnico;
- a interface não oferece uma etapa para executar os adapters;
- a rota de Preview não revalida todas as condições editoriais obrigatórias;
- o cliente poderia registrar estados sem comprovar que o processamento ocorreu.

## 2. Fluxo editorial canônico

```text
1. Briefing criado
2. Conteúdo estruturado
3. Adapters editoriais aplicados
   ├── DeskGo: identidade visual, organização e formato
   ├── Frankwatching: critérios editoriais, clareza e qualidade
   └── AMES: adaptação multiformato e conformidade estrutural
4. Gate editorial final executado novamente
5. Registro da branch, commit e PR
6. Preview Vercel
7. Revisão humana
8. Aprovação
9. Publicação
```

A fase oficial é:

> **E2 — Enriquecimento e validação editorial**, entre a edição do rascunho e o registro do artefato GitHub.

## 3. Correções P0

### 3.1 Criar a etapa visual E2

A interface deve apresentar uma etapa explícita chamada **Aplicar critérios editoriais** antes de exibir **Registrar artefato GitHub**.

A etapa deve mostrar, individualmente:

- status do DeskGo;
- status do Frankwatching;
- status do AMES;
- início e término da execução;
- versão do adapter;
- achados;
- evidência ou referência de saída;
- ação para consultar o relatório.

### 3.2 Executar os adapters no servidor

O cliente não deve marcar um adapter como `APPLIED` diretamente.

O servidor deve:

1. receber a solicitação de execução;
2. obter o conteúdo e a versão atuais;
3. calcular o hash do conteúdo;
4. executar o adapter correspondente;
5. validar a resposta;
6. persistir o resultado e a evidência;
7. registrar evento de auditoria;
8. retornar o novo estado.

### 3.3 Bloquear Preview com pendências

A publicação só pode avançar para `READY_FOR_PREVIEW` quando:

- briefing mínimo estiver completo;
- o artigo possuir H1;
- o artigo possuir uma ou mais seções H2;
- o conteúdo mínimo estiver presente;
- DeskGo estiver `APPLIED` com evidência válida;
- Frankwatching estiver `APPLIED` com evidência válida;
- AMES estiver `APPLIED` com evidência válida;
- o hash validado for igual ao hash do conteúdo atual;
- o gate final tiver sido executado após a última alteração.

### 3.4 Proteger `preview/start`

A rota deve rejeitar a chamada quando qualquer pré-condição estiver ausente, mesmo que a interface seja ignorada.

Validações obrigatórias:

```text
publication.status == READY_FOR_PREVIEW
quality.valid == true
deskgo.status == APPLIED
frankwatching.status == APPLIED
ames.status == APPLIED
quality.checked_at > content.updated_at
validated_content_hash == current_content_hash
validated_publication_version == current_publication_version
```

### 3.5 Transformar H1 e H2 em bloqueadores

A ausência de H1 ou H2 deve gerar erro técnico e levar a publicação para `VALIDATION_FAILED`.

Esses requisitos não devem permanecer como simples avisos de pontuação.

### 3.6 Separar gate técnico de pontuação editorial

A decisão de avanço deve ser binária:

```text
Gate técnico: APROVADO | REPROVADO
Pontuação editorial: 0–100
```

Uma pontuação alta não pode compensar um requisito obrigatório ausente.

Exemplo:

```text
Gate técnico: REPROVADO
Pontuação editorial: 90/100
Motivo: AMES não foi executado para a versão atual.
```

## 4. Estados dos adapters

Estados mínimos recomendados:

```text
NOT_RUN
RUNNING
APPLIED
FAILED
STALE
SKIPPED
```

Definições:

| Estado | Significado |
|---|---|
| `NOT_RUN` | Ainda não executado para esta publicação. |
| `RUNNING` | Execução em andamento. |
| `APPLIED` | Execução concluída com evidência válida. |
| `FAILED` | Execução falhou ou retornou resposta inválida. |
| `STALE` | O conteúdo mudou depois da execução. |
| `SKIPPED` | Dispensado por regra explícita, com justificativa e autorização. |

Para esta release, os três adapters são obrigatórios. Portanto, `SKIPPED` não libera o Preview sem uma decisão de produto posterior e documentada.

## 5. Evidência obrigatória

Cada adapter deve persistir um registro semelhante a:

```yaml
adapter: deskgo
status: APPLIED
adapter_version: "1.0.0"
publication_id: "PUB-..."
publication_version: 2
content_hash: "sha256:..."
started_at: "2026-07-28T00:00:00Z"
completed_at: "2026-07-28T00:00:05Z"
actor: "system:editorial-orchestrator"
findings:
  errors: []
  warnings: []
  recommendations: []
output_reference: "editorial-evidence://..."
```

`APPLIED` sem versão, hash, horários e referência de saída deve ser rejeitado.

## 6. Responsabilidade dos adapters

### DeskGo

Verifica e aplica:

- identidade editorial;
- organização e hierarquia;
- densidade cognitiva;
- legibilidade;
- consistência de formato;
- regras visuais e estruturais relevantes ao canal.

### Frankwatching

Verifica e aplica:

- clareza;
- força do título;
- qualidade da introdução;
- coerência;
- escaneabilidade;
- utilidade para a audiência;
- conclusão;
- chamada para ação;
- critérios editoriais de publicação.

### AMES

Verifica e aplica:

- estrutura semântica;
- conteúdo obrigatório;
- componentes editoriais;
- adaptação por formato;
- rastreabilidade;
- conformidade multiformato;
- regras de overflow, prioridade e representação.

## 7. Interface esperada

### 7.1 Estrutura mínima

```text
✓ Briefing completo
✓ Título H1
✓ Uma ou mais seções H2
✓ Conteúdo mínimo
```

### 7.2 Adapters editoriais

Antes da execução:

```text
DeskGo          Não executado    [Executar]
Frankwatching   Não executado    [Executar]
AMES            Não executado    [Executar]

[Aplicar todos os critérios editoriais]
```

Depois da execução:

```text
DeskGo          Aprovado         [Ver relatório]
Frankwatching   Aprovado         [Ver relatório]
AMES            Aprovado         [Ver relatório]
```

### 7.3 Gate final

```text
[Executar gate editorial final]
```

Somente depois da aprovação:

```text
Gate aprovado — conteúdo liberado para gerar artefato GitHub.

[Registrar artefato GitHub]
```

## 8. Máquina de estados recomendada

```text
DRAFT
  ↓
CONTENT_READY
  ↓
ENRICHING
  ↓
ADAPTERS_APPLIED
  ↓
VALIDATING
  ↓
READY_FOR_PREVIEW
  ↓
PREVIEW_BUILDING
  ↓
PREVIEW_READY
  ↓
IN_REVIEW
  ↓
APPROVED
  ↓
PUBLISHING
  ↓
PUBLISHED
```

Estados de retorno ou falha:

```text
ADAPTER_FAILED
VALIDATION_FAILED
CHANGES_REQUESTED
```

Qualquer alteração de conteúdo após `ADAPTERS_APPLIED` deve:

- aumentar a versão da publicação;
- mudar os resultados anteriores para `STALE`;
- invalidar o gate;
- remover a liberação de Preview;
- exigir nova execução dos três adapters.

## 9. Testes de aceite obrigatórios

| ID | Cenário | Resultado esperado |
|---|---|---|
| E2-T01 | DeskGo pendente | Gate reprovado; Preview bloqueado. |
| E2-T02 | Frankwatching pendente | Gate reprovado; Preview bloqueado. |
| E2-T03 | AMES pendente | Gate reprovado; Preview bloqueado. |
| E2-T04 | Um adapter falha | Estado `ADAPTER_FAILED`; Preview bloqueado. |
| E2-T05 | Cliente tenta marcar `APPLIED` sem evidência | API rejeita. |
| E2-T06 | Conteúdo muda após execução | Todos os resultados aplicáveis tornam-se `STALE`. |
| E2-T07 | H1 ausente | Gate reprovado. |
| E2-T08 | H2 ausente | Gate reprovado. |
| E2-T09 | Chamada direta a `preview/start` sem E2 | API retorna erro de domínio. |
| E2-T10 | Três adapters aplicados e gate aprovado | Avança para `READY_FOR_PREVIEW`. |
| E2-T11 | Hash do conteúdo mudou | Preview bloqueado. |
| E2-T12 | Commit não corresponde à versão validada | Registro do artefato rejeitado. |
| E2-T13 | Nova versão após Preview | Aprovação anterior invalidada. |
| E2-T14 | Reexecução idempotente sem mudança | Não duplica evidências nem eventos inconsistentes. |

## 10. Defeito registrado

```text
ID: DEF-E2-001
Título: Preview liberado sem execução dos adapters editoriais
Severidade: P0
Fase: E2 — Enriquecimento e validação editorial
Resultado esperado: DeskGo, Frankwatching e AMES executados antes do registro GitHub
Resultado observado: publicação liberada com os três adapters em PENDING
Impacto: o conteúdo pode avançar sem o enriquecimento e a validação prometidos
Decisão: corrigir antes do lançamento
```

## 11. Tratamento da rodada atual

O PR #29 pode permanecer como evidência de que branch, commit, PR e Preview foram registrados durante a descoberta do defeito.

Ele não deve ser usado como comprovação de homologação do fluxo editorial final, porque a etapa E2 não foi executada conforme o contrato esperado.

Nenhum adapter deve ser marcado manualmente como `APPLIED` apenas para concluir o teste.

## 12. Gate de release

A decisão permanece:

> **NO-GO até a implementação de E2, a proteção server-side de `preview/start` e a aprovação de todos os testes E2-T01 a E2-T14.**

A liberação do lançamento exige evidência vinculada ao commit testado, contendo:

- resultados dos adapters;
- versão da publicação;
- hash do conteúdo;
- resultado do gate técnico;
- pontuação editorial;
- Preview homologado;
- revisão humana;
- decisão final de release.
