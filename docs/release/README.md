# docs/release — Índice Mestre

Pacote de auditoria, roadmap e operação de lançamento do **EXECUTA.AI**.

- Baseline inicial: **2026-07-24**, commit `28a689f`.
- Homologação e fechamento do G1: **2026-07-25**.
- Início do G2 — contrato e teste do ciclo central: **2026-07-25**.
- Defeito editorial histórico `DEF-E2-001`: PR #30 reclassificado como gate
  interno da E1. A E2 oficial foi comprovada ponta a ponta pelos PRs #38 e #39
  e está **APROVADA**; E5 e E6 permanecem abertas.
- Auditoria independente + plano de GTM: **2026-07-28** (`13`, `14`) —
  primeira cobertura formal de posicionamento/público/canais do pacote;
  também resolve `RISK-004`/`EXA-G5-QA-001` (teste e2e intermitente) por
  re-execução confirmada nesta data.
- Ambiente canônico: **Vercel**, projeto `executar-ai`.
- Fonte documental: branch `main` de `oexecutor/P1.Executar.ai`.

> **Desambiguação obrigatória**: os gates **G0–G10** deste pacote são sobre
> **prontidão de lançamento público**. Eles não são os Gates 0–5 de
> `docs/GATE_PROGRESS.md`, que registram a migração técnica anterior.
>
> Este pacote supera as orientações históricas de Netlify. `AGENTS.md`,
> `SECURITY.md`, `docs/DEPLOYMENT_STATUS.md`, `docs/09_SECURITY_AND_GOVERNANCE.md`
> e `docs/13_DECISIONS_GAPS_ASSUMPTIONS.md` já foram alinhados ao ambiente
> canônico Vercel.

## Leitura recomendada

1. [`15-HOMOLOGACAO-E2-E4-2026-07-28.md`](./15-HOMOLOGACAO-E2-E4-2026-07-28.md) —
   evidência operacional da E2 oficial, publicação e QR Router.
2. [`13-AUDITORIA-RIGOROSA-2026-07-28.md`](./13-AUDITORIA-RIGOROSA-2026-07-28.md) —
   auditoria independente mais recente: re-verificação por evidência direta,
   achados novos e recomendações objetivas para as decisões pendentes.
3. [`14-PLANO-GTM.md`](./14-PLANO-GTM.md) — posicionamento, público-alvo,
   monetização e canais de lançamento; lacuna que não existia no pacote
   antes de 2026-07-28.
4. [`12-HOMOLOGACAO-E2-2026-07-28.md`](./12-HOMOLOGACAO-E2-2026-07-28.md) —
   correção do alcance: evidência do PR #30, não homologação da E2 oficial.
5. [`11-DEF-E2-001-NO-GO.md`](./11-DEF-E2-001-NO-GO.md) — registro histórico
   do defeito P0 e dos critérios que bloquearam o lançamento.
6. [`10-G2-CONTRATO-CICLO-CENTRAL.md`](./10-G2-CONTRATO-CICLO-CENTRAL.md) —
   decisão canônica do ciclo 3–9–36, integração PLANGEN e lacunas de homologação.
7. [`09-HOMOLOGACAO-G1-2026-07-25.md`](./09-HOMOLOGACAO-G1-2026-07-25.md) —
   fechamento do G1, produção homologada, PRs resolvidos e decisões vigentes.
8. [`01-ROADMAP-LANCAMENTO.md`](./01-ROADMAP-LANCAMENTO.md) — Gates G0–G10,
   fases, dependências e caminho crítico.
9. [`04-RISCOS-DECISOES.md`](./04-RISCOS-DECISOES.md) — riscos atuais e
   decisões de autenticação, persistência e MCP.

## Pacote completo

| Documento | Função |
|---|---|
| `00-STATUS-ATUAL.md` | Baseline histórico factual |
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
| `10-G2-CONTRATO-CICLO-CENTRAL.md` | Contrato, decisão PLANGEN, comparação de domínios e smoke test G2 |
| `11-DEF-E2-001-NO-GO.md` | Defeito P0, decisão NO-GO e critérios de saída |
| `12-HOMOLOGACAO-E2-2026-07-28.md` | Registro histórico do PR #30 e correção de classificação |
| `13-AUDITORIA-RIGOROSA-2026-07-28.md` | Auditoria independente, achados novos e recomendações de decisão |
| `14-PLANO-GTM.md` | Posicionamento, ICP, monetização, canais e métricas de GTM |
| `15-HOMOLOGACAO-E2-E4-2026-07-28.md` | Evidência operacional da E2, publicação e quatro QRs |
| `16-MENSAGEM-DE-LANCAMENTO.md` | Rascunho de mensagem para Show HN, Product Hunt, LinkedIn/X e comunidades de nicho |

## Estado resumido

- **G0 — baseline e roadmap:** **APROVADO**, integrado ao `main` pelo PR #11.
- **G1 — runtime e infraestrutura:** **APROVADO**. Vercel, Vault, APIs e MCP
  homologados; PRs #14 e #9 encerrados como superados; documentação operacional
  migrada de Netlify para Vercel pelos PRs #15 e #16.
- **G2 — ciclo central:** **EM EXECUÇÃO**. O contrato canônico e a decisão
  PLANGEN estão registrados; foi adicionada cobertura automatizada de criação,
  81 ações, 9 checkpoints, exportação, persistência e recuperação. Falta o smoke
  de escrita pelo fluxo real da interface.
- **Blog Integration V2 — E2:** **APROVADA**. Branch, pacote, PR e dois
  Previews foram vinculados ao mesmo SHA na publicação
  `PUB-20260728-b4fbb3cc`.
- **Blog Integration V2 — E3/E4:** evidência operacional concluída para a
  publicação de homologação; os quatro tokens estão ativos.
- **Blog Integration V2 — E5/E6:** **EM EXECUÇÃO**. Falta leitura física em
  celular, validação da impressão e conclusão de analytics/operação.
- **AMES:** o pacote do antigo PR #4 passou a existir na `main`, mas os
  validadores internos do aplicativo não executam essa skill.
- **G5 — teste e2e intermitente:** **RESOLVIDO** em 2026-07-28 por mudança
  arquitetural (raiz virou landing pública distinta, sem redirecionamento
  automático); re-executado 39/39 e 8/8 sem flakiness nesta auditoria.
- **GTM:** pacote antes não cobria posicionamento/público/canais —
  `14-PLANO-GTM.md` preenche a lacuna, com caminho híbrido recomendado
  (uso pessoal agora + beta fechado convidado em G6/G7) sujeito a
  confirmação do dono do produto.

## Regra de escrita externa

O backlog do Linear está preparado, mas não deve ser sincronizado sem aprovação
explícita do dono do produto. A frase operacional esperada é
`APROVADO PARA LINEAR`.

## Metodologia

Os documentos distinguem FATO, EVIDÊNCIA, INFERÊNCIA, LACUNA, BLOQUEIO e
DECISÃO. Evidências de produção são registradas separadamente de validações
locais para evitar que um deploy verde seja confundido com fluxo funcional
homologado.
