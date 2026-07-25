# 06 — Plano de Testes

Estado real confirmado nesta auditoria (2026-07-24, SHA `28a689f`) — não é um
plano aspiracional, é o que já roda mais o que falta.

## Unitários / Integração (backend)

- **Ferramenta**: Vitest.
- **Comando**: `npm test`.
- **Estado**: ✅ 21 arquivos / 140 testes, todos verdes (FATO, rodado nesta
  sessão). Cobre: guardas de path reservado (13), MCP DESK-OS (4), API PM
  (6), servidor MCP (3), aplicação (9), executar (7), auth (11), dashboard de
  workflow (3), adapter Vercel Node (13, incluindo os dois casos de erro
  intencionalmente injetados para provar que `safeError` não vaza detalhes),
  repositório (7), viewer (3), workflows (3), safe-error HTTP (6), vault (5),
  API do blog (7), domínio (10), CORS (10), ReDoS em busca (9), URL absoluta
  (4), dashboard (3), guarda de zip-bomb (4).

## Contratos

- **Contratos formais**: `contracts/project-management-api.yaml`,
  `contracts/mcp-tools.yaml`, `contracts/domain-model.yaml` (referenciados em
  `docs/GATE_PROGRESS.md`; não re-auditados linha a linha nesta passada —
  **EVIDÊNCIA**, não FATO, para esta auditoria específica).

## Componentes (frontend)

- **Ferramenta**: Vitest + Testing Library.
- **Comando**: `npm run test:web`.
- **Estado**: ✅ 3 arquivos / 10 testes verdes — `Login.test.tsx` (2),
  `App.test.tsx` (2), `BlogApp.test.tsx` (6).

## Playwright (e2e + acessibilidade)

- **Comando**: `npm run test:web:e2e` (Chromium pré-instalado neste
  ambiente).
- **Estado**: ⚠️ 10/11 testes verdes. Falha intermitente reproduzida em
  `raiz entra direto no workspace, sem tela de login` — `requestfailed:
  http://localhost:4173/icon.svg`, 2 de 3 execuções com `--repeat-each=3`.
  Hipótese registrada (não confirmada como causa raiz): corrida entre o
  fetch do favicon `/icon.svg` e um redirecionamento client-side de `/` para
  `/app` cancelando a requisição em voo. Ver `EXA-G5-QA-001`.
- **Acessibilidade**: `axe-playwright`, regras `wcag2a`/`wcag2aa`, impactos
  `critical`/`serious` — zero violações nos pontos cobertos (raiz sem login,
  portfólio, blog).

## Desktop / iPhone / iPad

- **Estado atual**: `web/e2e/app.spec.ts` testa viewports 375×800 (móvel) e
  834×1112 (tablet) — confirma ausência de rolagem horizontal na landing,
  workspace e blog. **LACUNA**: nenhum teste específico de Safari/iOS real
  (só Chromium); recomienda-se validação manual em dispositivo real antes do
  G6.

## Performance

- **LACUNA** — nenhum teste de performance/carga existe hoje no repositório.
  Não avaliado nesta auditoria. Recomendado antes do G9 (lançamento
  público), não antes.

## Segurança

- Cobertura existente via testes unitários: guarda de path reservado (13
  testes), proteção ReDoS (9 testes), guarda de zip-bomb (4 testes),
  `safeError` sem vazamento (6 testes), CORS (10 testes).
- **LACUNA**: nenhum teste automatizado de OAuth 2.1+PKCE ponta a ponta
  contra um servidor vivo nesta sessão (`npm run test:smoke` requer
  `SMOKE_BASE_URL`, indisponível). Recomendado rodar contra um preview
  deployment antes do G3 fechar.

## Persistência

- Coberta indiretamente por `tests/repository.test.ts` (7 testes:
  idempotência, concorrência otimista/409, auditoria, backups). **LACUNA**:
  nenhum teste automatizado compara comportamento Neon vs. Supabase lado a
  lado — relevante para `DECISÃO NECESSÁRIA #2`.

## Erros de rede / recuperação

- `tests/http-safe-error.test.ts` e `tests/http-absolute-url.test.ts` cobrem
  cenários de erro HTTP. **LACUNA**: nenhum teste de recuperação após queda
  de conexão com o banco (Neon/Supabase) nesta sessão.

## Logs

- **LACUNA** — não verificado nesta sessão (sem acesso ao painel Vercel).

## Smoke test de produção

- **Comando**: `npm run test:smoke` (`scripts/smoke-oauth.mjs`).
- **Estado**: 🔲 LACUNA — requer `SMOKE_BASE_URL`; nenhum preview deployment
  conhecido nesta sessão. **Importante**: este script grava dados reais via
  `OAuthPostgresStore` — nunca rodar contra produção, só contra preview.
- **Checklist manual alternativo** (já existente em `README-HOTFIX.md`):
  `curl -i https://executar-ai.vercel.app/api/auth/me`,
  `/api/executar/projects`, `/mcp`, mais abrir `/app` em janela anônima —
  não executado nesta sessão por bloqueio de rede do sandbox (403).

## CI (GitHub Actions)

- `.github/workflows/ci.yml` roda, em todo push/PR: job `check` (build + test
  + lint do backend) e job `web` (build + lint + testes de componente +
  instalação do Playwright + e2e). Config lida diretamente (FATO); a saída da
  última execução específica não foi recuperada nesta sessão (limite de
  tamanho da ferramenta de consulta) — tratado como EVIDÊNCIA indireta, não
  FATO, já que os mesmos comandos foram confirmados verdes localmente.
