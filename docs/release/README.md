# docs/release — Índice Mestre

Pacote de auditoria, roadmap e operação de lançamento do **EXECUTA.AI**.

- Baseline inicial: **2026-07-24**, commit `28a689f`.
- Homologação de produção e atualização G1: **2026-07-25**.
- Ambiente canônico: **Vercel**, projeto `executar-ai`.
- Fonte documental: branch `main` de `oexecutor/Executar.ai`.

> **Desambiguação obrigatória**: os gates **G0–G10** deste pacote são sobre
> **prontidão de lançamento público**. Eles não são os Gates 0–5 de
> `docs/GATE_PROGRESS.md`, que registram a migração técnica anterior.
>
> Este pacote supera `docs/DEPLOYMENT_STATUS.md` e demais orientações antigas
> voltadas a Netlify. Até a atualização completa de `AGENTS.md` e
> `SECURITY.md`, prevalecem os documentos desta pasta.

## Leitura recomendada

1. [`09-HOMOLOGACAO-G1-2026-07-25.md`](./09-HOMOLOGACAO-G1-2026-07-25.md) —
   atualização mais recente: produção, PRs resolvidos e decisões vigentes.
2. [`00-STATUS-ATUAL.md`](./00-STATUS-ATUAL.md) — baseline executivo da
   auditoria inicial.
3. [`01-ROADMAP-LANCAMENTO.md`](./01-ROADMAP-LANCAMENTO.md) — Gates G0–G10,
   fases, dependências e caminho crítico.
4. [`04-RISCOS-DECISOES.md`](./04-RISCOS-DECISOES.md) — riscos atuais e
   decisões resolvidas sobre autenticação, persistência e MCP.

## Pacote completo

| Documento | Função |
|---|---|
| `00-STATUS-ATUAL.md` | Baseline factual e tabela Área × Estado × Evidência × Bloqueio × Próxima ação |
| `01-ROADMAP-LANCAMENTO.md` | Roadmap G0–G10 de prontidão de lançamento |
| `02-BACKLOG-LINEAR.csv` | Backlog tabular pronto para revisão/importação |
| `02-BACKLOG-LINEAR.json` | Backlog estruturado para agentes e automação |
| `02-BACKLOG-LINEAR.md` | Versão humana e instruções de sincronização |
| `03-GATES-DE-RELEASE.md` | Critérios objetivos de entrada e saída de cada gate |
| `04-RISCOS-DECISOES.md` | Registro de riscos, decisões e mitigação |
| `05-CHECKLIST-LANCAMENTO.md` | Checklist por área e evidência exigida |
| `06-PLANO-DE-TESTES.md` | Estratégia e cobertura de qualidade |
| `07-PLANO-DE-ROLLBACK.md` | Procedimento de incidente e reversão |
| `08-OPERACAO-POS-LANCAMENTO.md` | Operação, suporte e monitoramento pós-lançamento |
| `09-HOMOLOGACAO-G1-2026-07-25.md` | Evidência viva da retomada após a interrupção do Manus |

## Estado resumido

- **G0 — baseline e roadmap:** aprovado e integrado ao `main`.
- **G1 — runtime e infraestrutura:** parcialmente aprovado; produção e APIs
  homologadas, PRs obsoletos encerrados e decisões técnicas registradas.
- **Pendência final do G1:** atualizar `AGENTS.md`, `SECURITY.md` e referências
  históricas que ainda instruem agentes a usar Netlify/senha de operador.
- **Próximo gate:** G2 — validar o ciclo central do produto ponta a ponta.

## Regra de escrita externa

O backlog do Linear está preparado, mas não deve ser sincronizado sem aprovação
explícita do dono do produto. A frase operacional esperada é
`APROVADO PARA LINEAR`.

## Metodologia

Os documentos distinguem FATO, EVIDÊNCIA, INFERÊNCIA, LACUNA, BLOQUEIO e
DECISÃO. Evidências de produção são registradas separadamente de validações
locais para evitar que um deploy verde seja confundido com fluxo funcional
homologado.
