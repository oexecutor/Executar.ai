# 05 — Checklist de Lançamento

Cada item: checkbox, responsável, evidência, data, gate relacionado. Estado
atual preenchido a partir da auditoria de 2026-07-24 (SHA `28a689f`), com
atualização de estado em **2026-07-28** (DEC-001/DEC-002 implementadas,
`RISK-004` confirmado resolvido). Itens sem evidência ficam com checkbox
vazio, nunca marcados como concluídos sem prova.

## Produto
- [ ] Ciclo central validado ponta a ponta em produção — Resp.: Execução assistida — Evidência: sessão gravada — Data: — — Gate: G2
- [ ] Onboarding de beta fechado funcional — Resp.: Product Owner — Evidência: sessão gravada — Data: — — Gate: G6 — **escopo reduzido 2026-07-28**: o fluxo já existe e é automático (trigger `create_personal_workspace` + Login.tsx, ver `17-ONBOARDING-BETA-FECHADO.md`); falta só rodar o teste de 5 min com uma pessoa real

## Engenharia
- [x] Build backend limpo — Resp.: Execução assistida — Evidência: `npm run build` (FATO) — Data: 2026-07-28 — Gate: G0
- [x] Testes backend verdes — Resp.: Execução assistida — Evidência: `npm test`, 204 testes (FATO, re-executado) — Data: 2026-07-28 — Gate: G0
- [x] Lint backend limpo — Resp.: Execução assistida — Evidência: `npm run lint` (FATO) — Data: 2026-07-28 — Gate: G0
- [x] Build/lint/testes web limpos — Resp.: Execução assistida — Evidência: `npm run build:web`/`lint:web`/`test:web` (FATO) — Data: 2026-07-28 — Gate: G0
- [x] Playwright 100% estável (0 flaky) — Resp.: Execução assistida — Evidência: `npx playwright test --repeat-each=3`, 39/39, 0 flaky (FATO, ver `13-AUDITORIA-RIGOROSA-2026-07-28.md`) — Data: 2026-07-28 — Gate: G5
- [ ] Hotfix de runtime confirmado ao vivo em produção — Resp.: Product Owner (acesso de rede) — Evidência: `curl -i` nas 4 rotas de `README-HOTFIX.md` — Data: — — Gate: G1

## Dados
- [x] Backend único de persistência decidido e implementado (Vault) — Resp.: Product Owner — Evidência: `ADR-002`, `04-RISCOS-DECISOES.md` DEC-002 — Data: 2026-07-28 — Gate: G3
- [ ] Migração de dados OAuth para Supabase (fase 2, `EXA-G3-DATA-002`) — Resp.: Execução assistida — Evidência: script de migração + paridade verificada — Data: — — Gate: G3
- [ ] Variáveis de ambiente de produção confirmadas por presença — Resp.: Product Owner — Evidência: export/screenshot do painel Vercel — Data: — — Gate: G3 — **crítico agora**: sem `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` configuradas, ninguém consegue logar (ver `/health`)

## Segurança
- [x] Política de autenticação decidida e implementada — Resp.: Product Owner — Evidência: `src/lib/request-auth.ts` (diff), `04-RISCOS-DECISOES.md` DEC-001 — Data: 2026-07-28 — Gate: G3
- [x] PR #9 fechado ou rebaseado conscientemente — Resp.: Product Owner — Evidência: encerrado sem merge em 2026-07-25 (`04-RISCOS-DECISOES.md` RISK-007) — Data: 2026-07-25 — Gate: G1

## Jurídico
- [ ] Termos de uso reais publicados — Resp.: Product Owner — Evidência: `web/public/terms.html` — conteúdo substantivo redigido (2026-07-28), não placeholder — **falta**: preencher razão social/CNPJ-CPF e comarca, e revisão jurídica antes de valer como termo vinculante — Data: — — Gate: G7

## Privacidade
- [ ] Política de privacidade real publicada e revisada — Resp.: Product Owner — Evidência: `web/public/privacy.html` — política completa (LGPD, base legal por categoria, direitos do titular, sub-processadores nomeados) redigida 2026-07-28, não placeholder — **falta**: preencher identidade do controlador e revisão jurídica — Data: — — Gate: G7

## Acessibilidade
- [x] `axe-playwright` sem violações críticas/sérias nos fluxos cobertos — Resp.: Execução assistida — Evidência: `web/e2e/app.spec.ts` (FATO) — Data: 2026-07-24 — Gate: G0
- [x] Cobertura de a11y avaliada além do fluxo raiz/blog — Resp.: Execução assistida — Evidência: `web/e2e/app.spec.ts` cobre raiz, portfólio/projeto, editorial E1/E2, QR E4, índice e artigo do blog (6 pontos, FATO) — Data: 2026-07-28 — Gate: G5 — restam fora: página de login (não testada em e2e, usa mock) e telas administrativas

## Conteúdo
- [x] EXECUTA Journal (blog) integrado ao build — Resp.: Execução assistida — Evidência: `web/src/blog/*`, testes verdes (FATO) — Data: 2026-07-24 — Gate: G0

## Blog
- [x] Deep link, busca e carrossel funcionam localmente — Resp.: Execução assistida — Evidência: `web/e2e/app.spec.ts` (FATO) — Data: 2026-07-24 — Gate: G0
- [ ] Regressão confirmada em produção real — Resp.: Execução assistida — Evidência: verificação manual — Data: — — Gate: G4

## Domínio
- [ ] Domínio de produção confirmado e configurado — Resp.: Product Owner — Evidência: painel Vercel — Data: — — Gate: G9

## SEO
- [x] SEO do blog confirmado (meta tags, sitemap) — Resp.: Execução assistida — Evidência: `robots.txt`, `sitemap.xml` (gerado automaticamente no build), OG/Twitter Card e canonical em landing/blog/artigos (FATO, build local verificado) — Data: 2026-07-28 — Gate: G4

## Analytics
- [ ] Ferramenta de analytics decidida e instalada — Resp.: Product Owner — Evidência: — — Data: — — Gate: G7

## Suporte
- [x] Plano de suporte documentado — Resp.: Execução assistida — Evidência: `08-OPERACAO-POS-LANCAMENTO.md` (canal, SLA informal, triagem) — Data: 2026-07-28 — Gate: G7 — **pendência menor**: e-mail de suporte ainda é placeholder em `terms.html`/`privacy.html`

## Incidentes
- [x] Processo de resposta a incidentes documentado — Resp.: Execução assistida — Evidência: `07-PLANO-DE-ROLLBACK.md` (identificação, rollback de auth, comunicação, registro pós-incidente) — Data: 2026-07-28 — Gate: G7

## Rollback
- [x] Plano de rollback documentado — Resp.: Execução assistida — Evidência: `07-PLANO-DE-ROLLBACK.md` (este pacote) — Data: 2026-07-24 — Gate: G0

## Comunicação
- [x] Mensagem de lançamento preparada — Resp.: Execução assistida — Evidência: `16-MENSAGEM-DE-LANCAMENTO.md` (Show HN, Product Hunt, LinkedIn/X, comunidades PKM) — Data: 2026-07-28 — Gate: G9 — revisar tom/números antes de publicar de fato

## Onboarding
- [ ] Onboarding de primeiro uso testado com usuário real — Resp.: Product Owner — Evidência: sessão gravada — Data: — — Gate: G6 — mesmo item do bloco Produto acima; único bloqueador real é executar o teste de 5 min descrito em `17-ONBOARDING-BETA-FECHADO.md`

## Documentação
- [x] `AGENTS.md`/`SECURITY.md`/docs estruturais atualizados (Vercel, não Netlify) — Resp.: Execução assistida — Evidência: menções a Netlify restam só como nota histórica explicitamente superada (`docs/DEPLOYMENT_STATUS.md`), sem instrução ativa — Data: 2026-07-25 — Gate: G1

## Operação pós-lançamento
- [x] Cadência de revisão 24h/7d/30d definida — Resp.: Execução assistida — Evidência: `08-OPERACAO-POS-LANCAMENTO.md` (checklist concreto por janela) — Data: 2026-07-28 — Gate: G10
