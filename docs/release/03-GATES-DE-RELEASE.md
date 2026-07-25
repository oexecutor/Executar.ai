# 03 — Gates de Release: Critérios Objetivos de Passagem

Critérios binários (passa/não passa), verificáveis por evidência — não por
opinião. Cada critério cita como verificar e o estado atual confirmado nesta
auditoria (2026-07-24, SHA `28a689f`).

| Critério | Como verificar | Estado atual |
|---|---|---|
| Zero erros TypeScript | `npm run build` e `npm run build:web` | ✅ PASS (FATO, confirmado nesta sessão) |
| Zero testes aplicáveis falhando | `npm test` + `npm run test:web` | ✅ PASS — 21 arquivos/140 testes (backend) + 3 arquivos/10 testes (web), todos verdes |
| Playwright verde | `npm run test:web:e2e` | ⚠️ PARCIAL — 10/11 testes verdes; 1 teste intermitente reproduzido 2/3 execuções (ver G5, `EXA-G5-QA-001`) |
| Zero erros 500 nos fluxos homologados | `curl` GET-only contra produção | 🔲 LACUNA — sem acesso de rede a produção nesta sessão |
| Projeto criado e persistido | Ciclo completo via `/api/executar` ou `/mcp` | ⚠️ Validado localmente via testes (`tests/executar.test.ts`, `tests/mcp-desk-os.test.ts`); não validado ao vivo em produção (G2) |
| Reload preserva dados | `web/e2e/app.spec.ts` — "recarregar a página mantém o acesso ao workspace" | ✅ PASS (teste e2e verde) |
| Blog acessível por deep link | `web/e2e/app.spec.ts` — "artigo abre por slug diretamente, refresh não gera 404" | ✅ PASS |
| Mobile homologado | `web/e2e/app.spec.ts` — testes de responsividade 375px/834px, sem rolagem horizontal | ✅ PASS |
| Logs sem erros novos | Revisão de `runtime logs` no painel Vercel | 🔲 LACUNA — sem acesso ao painel Vercel nesta sessão |
| Rollback documentado | `07-PLANO-DE-ROLLBACK.md` | ✅ Este pacote inclui o plano |
| Monitoramento ativo | Confirmar no painel Vercel / serviço externo | 🔲 NÃO CONFIRMADO — não verificado nesta sessão, sem evidência de ferramenta de monitoramento configurada |
| Política de privacidade e termos avaliados antes do público | Revisão jurídica de `web/public/privacy.html` | 🔲 NÃO CONFIRMADO — arquivo existe mas conteúdo não foi validado como real política legal (G7) |
| Zero erros TypeScript em CI | `.github/workflows/ci.yml` job `check` | EVIDÊNCIA (config lida, roda os mesmos comandos verificados localmente; log da última execução não recuperado nesta sessão por limite de tooling) |
| Acessibilidade sem violações críticas/sérias | `axe-playwright` (wcag2a/wcag2aa) em `web/e2e/app.spec.ts` | ✅ PASS nos pontos cobertos (login-free root, blog) |

## Regra de gate

Nenhum gate G6 (beta fechado) em diante pode abrir enquanto houver qualquer
linha com estado 🔲 (LACUNA/NÃO CONFIRMADO) ou ⚠️ (PARCIAL) nesta tabela sem
uma decisão explícita registrada em `04-RISCOS-DECISOES.md` justificando o
avanço mesmo assim.
