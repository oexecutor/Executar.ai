# DESK-OS PM — Progresso dos Gates

Atualizado em 2026-07-20, na branch `claude/executar-ai-desk-os-migration-ctul7o`.
Referências: `docs/10_IMPLEMENTATION_PLAN.md`, `docs/IMPLEMENTATION_BASELINE.md` (§12–§14).

## Concluído

### Gate 0 — Baseline e verificação
- Fonte real (`Código_do_mcp_atual_.zip`, v1.6.0) + pacote de handoff importados no repositório
  conforme `docs/GUIA_INICIO_CLAUDE_CODE.md` Passo 2 (commit "baseline import").
- `npm run build` (tsc) e `npm test` verificados: 7 arquivos / 23 testes, exatamente como o
  baseline §9/§14 previa. Nenhum comportamento alterado nesse commit.

### Gate 0.5 — Segurança (baseline §13, Opção B)
- `verifyAdminPassword`/`verifyAdminRequest` deixaram de ser stubs `return true`.
- Sessão de operador: JWT assinado em cookie `HttpOnly; Secure; SameSite=Lax` (8 h),
  emitido por `POST /api/admin/login` (compara `ADMIN_PASSWORD` com `timingSafeEqual`,
  falha fechado quando a variável não existe) e limpo por `POST /api/admin/logout`.
- Rotas protegidas: `/api/vault/files|status|import|export` (401 JSON), `/view` e
  `/dashboard` (formulário de login sem JS). `/health` continua público.
- `/mcp` + OAuth intocados (já adequados, baseline §5).
- Painel `public/index.html` ganhou fluxo login/logout.
- Critério do baseline §9 coberto por teste: escrita não autenticada → 401.

### Gate 1 — Domínio puro (`src/domain/`)
- Implementa `contracts/domain-model.yaml` v1.0.0: entidades, enums (incl. taxonomia
  epistêmica de 7 tipos), IDs prefixados, guards de transição, regras de capacidade
  (máx. 3 passos, 1 workflow ativo, 1 entrega dominante/dia, ciclo de dependências),
  schemas zod e factories. Sem imports de Netlify/MCP/UI.

### Gate 2 — Repositório (`src/repository/`)
- Estado em `_desk-os/state/**` via `BlobVaultService` existente (sem segundo store).
- Índices por tipo em `_desk-os/index/**` eliminam o fan-out do `allRecords()` nas
  leituras quentes (baseline §4/§11.2), com rebuild determinístico.
- Concorrência otimista (`expected_version` → 409), idempotência com recibos,
  auditoria append-only com índice limitado, backups rotulados pré-apply.
- Editor genérico (`/api/vault/files`) não escreve em `_desk-os/`.

### Gate 3 — Serviços de aplicação (`src/application/`)
- `DeskOsService`: superfície única chamada por MCP e HTTP. Today, board, buscas,
  CRUD com validação/transições/limites, workflow de decomposição
  (`prepare` → aprovação humana → `apply` com backup) e fechamento de sprint com DECISION.

### Gate 4 — MCP (`src/mcp/desk-os-tools.mts`)
- 18 ferramentas `desk_os_*` de `contracts/mcp-tools.yaml` registradas ADITIVAMENTE:
  as 19 ferramentas `obsidian_*`/`desk_*` continuam intactas (baseline §3, DEC-002).
- Envelope de saída do contrato; `apply` exige `approved_by_user=true`; leitura não muta.

### Gate 5 — metade API (`netlify/functions/pm.mts`)
- `/api/pm/*` conforme `contracts/project-management-api.yaml`, protegido pela sessão
  de operador, adapter fino sobre `DeskOsService`.

### Gate 6 — parcial
- CI (GitHub Actions): tsc + vitest em cada push/PR.
- Suíte atual: 12 arquivos / 66 testes verdes.

## Pendente (GAPs explícitos)

1. **Frontend Sprint/Kanban (Gate 5, metade UI)** — a UI React (Today, Projects,
   Kanban com drag-and-drop, Capture, Proposal review) não foi iniciada. O painel
   atual (`public/index.html`) segue como navegador de vault. Recomendação do
   baseline §1: Vite + React como adição, consumindo `/api/pm/*`.
2. **Smoke local `netlify dev` + `npm run test:smoke`** — não executados neste
   ambiente (sem `netlify-cli`; download de binários bloqueado pelo proxy).
   Rodar localmente antes do Deploy Preview.
3. **Lint (`npm run lint`)** — o `package.json` real (v1.6.0) não traz ESLint;
   adicionar no fechamento do Gate 6 sem reestruturar os scripts existentes.
4. **E2E/acessibilidade (Gate 6)** — dependem do frontend.
5. **Variáveis no Netlify** — definir `ADMIN_PASSWORD` (novo) antes de qualquer
   deploy; sem ela o login falha fechado e o painel/vault ficam inacessíveis via HTTP.
   `MCP_JWT_SECRET` e `PUBLIC_BASE_URL` continuam obrigatórias.
6. **Ferramentas MCP legadas ainda escrevem em `_desk-os/`** — as `obsidian_*`
   (create/update/move/copy) não bloqueiam o prefixo reservado; risco baixo
   (exigem OAuth) mas vale um guard no fechamento do Gate 6.
7. **`deleteAllActiveFiles()` (baseline §11.7)** — continua no código, sem chamador;
   remover ou proteger explicitamente.
8. **Riscos do baseline §11 ainda abertos**: ReDoS na busca (§11.1), zip-bomb no
   import (§11.3), mimeType armazenado (§11.4), CSP `unsafe-inline` (§11.5),
   `safeError` vazando `Error.message` (§11.6).

## Regras de deploy

Nenhum deploy de produção foi feito ou será feito sem aprovação explícita do
Leonardo (DEC-009, `plans/DEPLOY_GATES.md`). Produção segue exatamente como estava.
