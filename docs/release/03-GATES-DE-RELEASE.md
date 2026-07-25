# 03 — Gates de Release: Critérios Objetivos de Passagem

Critérios binários e verificáveis por evidência. O baseline foi produzido em
2026-07-24 e os critérios de infraestrutura foram atualizados após homologação
Vercel e fechamento do G1 em 2026-07-25.

| Critério | Como verificar | Estado atual |
|---|---|---|
| Zero erros TypeScript | `npm run build` e `npm run build:web` | ✅ PASS — builds locais e Vercel concluídos |
| Zero testes aplicáveis falhando | `npm test` + `npm run test:web` | ✅ PASS no baseline — 140 testes backend + 10 testes web |
| Playwright verde | `npm run test:web:e2e` | ⚠️ PARCIAL — 10/11 no baseline; 1 teste intermitente ligado a `/icon.svg` permanece para G5 |
| Zero erros 500 nos fluxos homologados | chamadas GET contra produção | ✅ PASS para identidade, projetos e Vault; MCP retorna o 401 OAuth esperado, sem 500 |
| Projeto criado e persistido | ciclo completo via `/api/executar` ou `/mcp` | ⚠️ Validado por testes e leitura em produção; criação ponta a ponta permanece como critério central do G2 |
| Reload preserva dados | teste e2e e recuperação em produção | ✅ PASS no teste e2e do baseline; recuperação completa será revalidada no G2 |
| Blog acessível por deep link | teste direto por slug + refresh | ✅ PASS no baseline |
| Mobile homologado | testes 375px/834px, sem rolagem horizontal | ✅ PASS no baseline |
| Logs sem erros novos | revisão de runtime logs Vercel | ✅ PASS para as rotas Vault na janela verificada de 24 horas |
| Rollback documentado | `07-PLANO-DE-ROLLBACK.md` | ✅ PASS |
| Monitoramento ativo | painel Vercel / serviço externo | 🔲 NÃO CONFIRMADO — exigido antes de G6 |
| Política de privacidade e termos avaliados | revisão jurídica de `web/public/privacy.html` | 🔲 NÃO CONFIRMADO — exigido em G7 |
| Orientação operacional atualizada | `AGENTS.md`, `SECURITY.md`, deployment e governança | ✅ PASS — migração documental Netlify → Vercel integrada pelo PR #16 |
| Acessibilidade sem violações críticas/sérias | `axe-playwright` em fluxos cobertos | ✅ PASS nos pontos cobertos pelo baseline |

## Estado dos gates iniciais

- **G0 — Auditoria e baseline confiável:** ✅ APROVADO.
- **G1 — Runtime e infraestrutura estáveis:** ✅ APROVADO.
- **G2 — Ciclo central do produto funcional:** ▶ PRÓXIMO GATE.

## Regra de gate

Nenhum gate G6 (beta fechado) em diante pode abrir enquanto houver linha com
estado 🔲 ou ⚠️ nesta tabela sem correção ou decisão explícita registrada em
`04-RISCOS-DECISOES.md`.
