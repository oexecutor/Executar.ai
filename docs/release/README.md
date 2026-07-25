# docs/release — Índice Mestre

Pacote de auditoria, roadmap e operação de lançamento do **EXECUTA.AI**.

- Baseline inicial: **2026-07-24**, commit `28a689f`.
- Homologação e fechamento do G1: **2026-07-25**.
- Ambiente canônico: **Vercel**, projeto `executar-ai`.
- Fonte documental: branch `main` de `oexecutor/Executar.ai`.

> **Desambiguação obrigatória**: os gates **G0–G10** deste pacote são sobre
> **prontidão de lançamento público**. Eles não são os Gates 0–5 de
> `docs/GATE_PROGRESS.md`, que registram a migração técnica anterior.
>
> Este pacote supera as orientações históricas de Netlify. `AGENTS.md`,
> `SECURITY.md`, `docs/DEPLOYMENT_STATUS.md`, `docs/09_SECURITY_AND_GOVERNANCE.md`
> e `docs/13_DECISIONS_GAPS_ASSUMPTIONS.md` já foram alinhados ao ambiente
> canônico Vercel.

## Leitura recomendada

1. [`09-HOMOLOGACAO-G1-2026-07-25.md`](./09-HOMOLOGACAO-G1-2026-07-25.md) —
   fechamento do G1, produção homologada, PRs resolvidos e decisões vigentes.
2. [`01-ROADMAP-LANCAMENTO.md`](./01-ROADMAP-LANCAMENTO.md) — Gates G0–G10,
   fases, dependências e caminho crítico.
3. [`04-RISCOS-DECISOES.md`](./04-RISCOS-DECISOES.md) — riscos atuais e
   decisões de autenticação, persistência e MCP.
4. [`00-STATUS-ATUAL.md`](./00-STATUS-ATUAL.md) — baseline histórico da
   auditoria inicial; consultar a homologação G1 para o estado mais recente.

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
| `09-HOMOLOGACAO-G1-2026-07-25.md` | Evidência viva da retomada e fechamento do G1 |

## Estado resumido

- **G0 — baseline e roadmap:** **APROVADO**, integrado ao `main` pelo PR #11.
- **G1 — runtime e infraestrutura:** **APROVADO**. Vercel, Vault, APIs e MCP
  homologados; PRs #14 e #9 encerrados como superados; documentação operacional
  migrada de Netlify para Vercel pelos PRs #15 e #16.
- **PR #4 — AMES:** permanece em draft, fora do runtime do app, aguardando
  migração controlada para `HQ-EXECUTA-AI-PLUGIN-SUITE`.
- **Próximo gate:** **G2 — validar o ciclo central do produto ponta a ponta**.

## Regra de escrita externa

O backlog do Linear está preparado, mas não deve ser sincronizado sem aprovação
explícita do dono do produto. A frase operacional esperada é
`APROVADO PARA LINEAR`.

## Metodologia

Os documentos distinguem FATO, EVIDÊNCIA, INFERÊNCIA, LACUNA, BLOQUEIO e
DECISÃO. Evidências de produção são registradas separadamente de validações
locais para evitar que um deploy verde seja confundido com fluxo funcional
homologado.
