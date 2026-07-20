# Workflow Dashboard Integration — v1.6.0

## Objetivo

A ferramenta `desk_ingest_workflow_dashboard` recebe o resultado estruturado de um workflow, mantém um estado cumulativo por IDs estáveis e regenera um dashboard HTML dentro do vault.

Ela não tenta inferir semanticamente o conteúdo bruto. O Claude ou outro host faz a análise e envia fatos estruturados ao conector.

## Arquivos gerados

Para `workflowId: WORKOS-CONSULTORIA`, o padrão é:

```text
DESK-OS/Dashboards/Workflows/WORKOS-CONSULTORIA/
├── DASHBOARD.md
├── STATUS_DASHBOARD.html
├── WORKFLOW_STATUS.json
└── history/
    └── <timestamp>_<sequência>.json
```

- `WORKFLOW_STATUS.json`: fonte de verdade estruturada.
- `STATUS_DASHBOARD.html`: visualização gerada; não deve ser editada manualmente.
- `DASHBOARD.md`: índice legível no Obsidian, com links e indicadores.
- `history/`: snapshot imutável de cada ingestão.

## Modos

### replace

Substitui integralmente coleções de fontes, áreas, decisões, lacunas, contraevidências e riscos. Use na primeira carga ou quando o workflow produziu um snapshot completo.

### upsert

Atualiza ou adiciona itens pelo campo `id`, preservando os demais. Use em ingestões incrementais.

Para remover itens em modo `upsert`, use `remove`:

```json
{
  "remove": {
    "gapIds": ["GAP-011"],
    "riskIds": ["RISK-001"]
  }
}
```

## Concorrência

`expectedStateSha256` é opcional, mas recomendado quando mais de um agente pode atualizar o mesmo workflow. O valor deve ser o SHA-256 atual de `WORKFLOW_STATUS.json`.

Em caso de divergência, a ferramenta devolve `CONFLICT` e não grava a atualização.

## Renderização segura

O dashboard é gerado sem dependências externas e sem JavaScript. Gráficos são construídos com CSS acessível. A rota `/dashboard` só executa arquivos que:

- estejam em `DESK-OS/Dashboards/Workflows/`;
- terminem em `STATUS_DASHBOARD.html`;
- contenham a assinatura de geração do DESK-OS.

A resposta aplica uma Content Security Policy que bloqueia scripts, conexões externas e frames.

## Primeiro uso pelo Claude

```text
Leia e analise o Product Source of Truth.
Separe fontes, áreas, decisões, lacunas, contraevidências e riscos.
Não invente itens ausentes; marque-os como LACUNA.

Depois chame desk_ingest_workflow_dashboard em mode=replace com:
- workflowId: WORKOS-CONSULTORIA
- gate conforme a decisão atual
- IDs estáveis para todos os registros
- sourcePaths dos documentos usados

Retorne dashboardUrl, state.sha256 e a próxima ação.
```

## Atualização incremental

```text
Use os novos dados do workflow para atualizar WORKOS-CONSULTORIA.
Leia primeiro WORKFLOW_STATUS.json e preserve seu sha256.
Chame desk_ingest_workflow_dashboard em mode=upsert.
Envie apenas os itens novos ou alterados e use remove para registros encerrados.
Retorne o novo dashboardUrl, updateSequence e diferenças de contagem.
```

## Payload inicial

`templates/WORKOS_NEUROADAPTADO_INITIAL_PAYLOAD.json` reproduz os dados explícitos do dashboard de referência. Riscos ou contraevidências sem descrição na referência estão identificados como `LACUNA`, e não como fatos inventados.
