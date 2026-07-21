# DESK-OS PM — Progresso dos Gates

Atualizado em 2026-07-21, na branch `claude/executar-ai-desk-os-migration-ctul7o` (PR draft #1).
Referências: `docs/10_IMPLEMENTATION_PLAN.md`, `docs/IMPLEMENTATION_BASELINE.md` (§12–§14), `README.md`, `contracts/`.

Este documento tem duas partes: **§1** é o registro histórico de cada gate (Gates 0–5).
**§2** é a auditoria e o ciclo de correções pedidos após o PR draft #1 estar aberto —
cada achado é classificado como **FATO** (verificado por leitura direta de código ou
execução), **EVIDÊNCIA** (observado indiretamente, ex. via teste), **INFERÊNCIA**
(dedução razoável, não executada), **RISCO** (exposição que permanece) ou **LACUNA**
(algo que não pôde ser verificado neste ambiente).

---

## §1 — Histórico dos gates

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

### Gate 5 — API + UI
- **API** (`netlify/functions/pm.mts`): `/api/pm/*` conforme `contracts/project-management-api.yaml`,
  protegido pela sessão de operador, adapter fino sobre `DeskOsService`.
- **UI** (`web/`): app Vite + React + TypeScript novo, adição — `public/index.html` (navegador
  do vault) continua estável (DEC-002). Build para `public/app/`. Ver §2.7 abaixo.

---

## §2 — Auditoria e correções (pós-PR draft #1)

### 2.1 Auditoria do estado real

| Item auditado | Classificação | Achado |
| --- | --- | --- |
| `ADMIN_PASSWORD` compara com `timingSafeEqual` | **FATO** | `src/lib/auth.mts::verifyAdminPassword`, confirmado por leitura direta. |
| Falha fechada sem `ADMIN_PASSWORD` | **FATO** | Mesma função: `if (!expected) return false`. Testado em `tests/auth.test.ts`. |
| Cookies `HttpOnly; Secure; SameSite=Lax` | **FATO** | `adminCookie()` em `src/lib/auth.mts`, testado. |
| `/api/vault/*` e `/api/pm/*` exigem sessão | **FATO** | Todas as 7 funções relevantes chamam `requireAdminJson`/`requireAdminHtml`, confirmado por grep + testes de 401. |
| Projetos/sprints/tarefas/Kanban/Today funcionam | **FATO** | Ciclo completo testado via MCP (`tests/mcp-desk-os.test.ts`) e via HTTP (`tests/pm-api.test.ts`) e via browser real (`web/e2e/app.spec.ts`). |
| Idempotência, 409 de concorrência, auditoria, backups | **FATO** | `tests/repository.test.ts` (7 testes) exercita exatamente esses 4 comportamentos. |
| Compilação TypeScript | **FATO** | `tsc --noEmit` limpo, confirmado nesta sessão. |
| Contagem/resultado real de testes | **FATO** | 16 arquivos / 97 testes (backend) + 3 arquivos / 8 testes (componentes web) + 1 arquivo / 4 testes (e2e web) — todos verdes, confirmado nesta sessão. |
| **Achado novo**: ferramentas MCP legadas e `vault-import.mts` não bloqueavam escrita em `_desk-os/` | **FATO** | Só `vault-files.mts` tinha o guard. Corrigido — ver §2.2. |
| **Achado novo**: `safeError` vazava `Error.message` bruto | **FATO** | Confirmado por leitura + teste que provou o vazamento antes da correção. |
| **Achado novo**: busca com regex sem orçamento de tempo (ReDoS) | **FATO** | Confirmado por leitura; padrões catastróficos clássicos não eram rejeitados. |
| **Achado novo**: `vault-import.mts` inflava o zip inteiro antes de checar tamanho | **FATO** | Confirmado por leitura; um zip de 200MB de zeros comprime para ~200KB, bem abaixo do limite de upload. |

### 2.2 Correções aplicadas (nesta ordem, cada uma com commit e testes próprios)

1. **Bypass de `_desk-os/`, busca completa** — não só os dois exemplos citados. Centralizei o
   guard em `BlobVaultService` (`src/lib/vault.mts`): `putBytes`, `trash` e a origem de `move`
   agora rejeitam qualquer path sob `_desk-os/` a menos que o chamador seja construído com
   `allowReservedPaths: true` (só `src/repository/vault-adapter.mts` usa essa flag). Isso cobre
   automaticamente as 7 ferramentas MCP legadas que escrevem por path (`create_note`,
   `update_note`, `update_frontmatter`, `move_entry`, `copy_entry`, `import_binary`,
   `restore_trash`) e o `vault-import.mts`, sem precisar de guard em cada call site — e cobre
   qualquer ponto de escrita futuro que alguém esqueça de proteger.
   `tests/reserved-path-guard.test.ts` (12 testes) prova isso: chamadas diretas ao
   `BlobVaultService`, as ferramentas MCP legadas via transporte real, e `/api/vault/import`
   com um zip contendo uma entrada em `_desk-os/` — todos bloqueados; a escrita legítima do
   repositório continua funcionando.
2. **`safeError` sem vazamento** — só `VaultProblem` (erro de domínio deliberadamente seguro)
   chega ao cliente; qualquer outra exceção vira uma mensagem genérica fixa, com o detalhe real
   só no log do servidor. Formato de resposta preservado (`{error: string, message: string}`)
   para não quebrar o contrato RFC 6749 que `oauth-token.mts`/`oauth-register.mts` usam.
   `tests/http-safe-error.test.ts` (6 testes) prova isso, inclusive ponta a ponta contra
   `oauth-token.mts`.
3. **ReDoS na busca** — rejeita os dois padrões catastróficos clássicos (quantificador aninhado
   e alternância quantificada), limita o tamanho do padrão a 200 caracteres, limita a 2000
   caracteres o texto de cada linha testado contra regex, e aplica orçamento de 4s agregado
   entre arquivos. `tests/search-redos.test.ts` (9 testes) prova a rejeição e mede tempo real
   contra uma linha adversarial de 50 mil caracteres.
4. **Zip-bomb no import** — usa o `filter` do `fflate.unzipSync`, que recebe o tamanho
   *declarado* de cada entrada antes de descomprimir. Entradas que excedem o limite por
   arquivo, o orçamento total ou a contagem máxima nunca são infladas. `tests/zip-bomb-guard.test.ts`
   (4 testes) prova isso contra bombas reais de alta razão de compressão (200MB declarados em
   ~200KB comprimidos), medindo que a resposta volta em bem menos de 1 segundo.
5. **Lint funcional** — ESLint 8 + `@typescript-eslint` configurados (o `package.json` real
   não tinha nenhum). `npm run lint` limpo no backend; corrigiu 2 problemas reais (import não
   usado, escape de regex desnecessário). Bônus: `npm audit` encontrou uma vulnerabilidade
   crítica no `vitest` fixado (`GHSA-5xrq-8626-4rwp`, leitura/execução arbitrária de arquivo
   quando o servidor de UI do Vitest está ativo — nunca usamos esse modo, mas é uma correção
   de patch grátis); atualizado para 3.2.6, `npm audit` limpo.
6. **Smoke test compatível** — `scripts/smoke-oauth.mjs` agora faz login (`SMOKE_ADMIN_PASSWORD`)
   antes de chamar `/api/vault/import|status|export`, e verifica explicitamente que uma chamada
   sem sessão continua recebendo 401. Ver §2.3 sobre a limitação de rodar isso neste ambiente.
7. **Interface React mínima** — ver §2.7.

### 2.3 LACUNA — `netlify dev` não roda neste ambiente

**LACUNA confirmada por reprodução direta.** O proxy de saída deste ambiente sandboxed retorna
403 para o binário `sharp`/`libvips` que é dependência transitiva do `netlify-cli` (usado para
processamento de imagem, não relacionado a este projeto). Um `npx netlify-cli --version` puro
(sem contexto de site, sem link, sem deploy) completa e reporta `netlify-cli/26.2.0` — ou seja, o
pacote em si é alcançável; é especificamente a cadeia de dependências do `netlify dev` que o
proxy bloqueia aqui.

**Comando exato para rodar localmente** (fora deste sandbox, com internet normal):

```bash
npm install
netlify link
ADMIN_PASSWORD=<valor> PUBLIC_BASE_URL=http://localhost:8888 \
  MCP_JWT_SECRET=<32+ caracteres> netlify dev
# em outro terminal, com o servidor no ar:
SMOKE_BASE_URL=http://localhost:8888 SMOKE_ADMIN_PASSWORD=<mesmo valor> \
  npm run test:smoke
```

### 2.4 ADMIN_PASSWORD no Netlify

**Não configurei isso** — é uma variável de ambiente do site de produção/preview no painel do
Netlify, e eu não tenho (nem deveria ter, sem autorização explícita separada) acesso a esse
painel a partir desta sessão. Sem ela, o login falha fechado (503 `AUTH_NOT_CONFIGURED`) e todo
o painel/vault/PM fica inacessível via HTTP — isso é o comportamento correto e intencional do
Gate 0.5, não um bug. **Ação necessária sua**: definir `ADMIN_PASSWORD` (e confirmar
`MCP_JWT_SECRET`/`PUBLIC_BASE_URL`) nas variáveis de ambiente do site no Netlify antes de
qualquer Deploy Preview ser útil para teste manual.

### 2.5 Regras de push/deploy nesta sessão

Conforme sua instrução: **nenhum push foi feito para `main`** ou qualquer branch conectada à
produção — todo o trabalho ficou em `claude/executar-ai-desk-os-migration-ctul7o` (a branch do
PR draft #1), que é a branch de trabalho, não a de produção. **Não posso comprovar a partir
deste ambiente** se o Netlify está configurado para disparar apenas Deploy Preview nessa branch
ou se há alguma configuração de auto-publish mais ampla — isso está fora do meu alcance de
verificação aqui (não tenho acesso ao painel do Netlify). Recomendo confirmar manualmente antes
do próximo push: Site settings → Build & deploy → Deploy contexts, e confirmar que `main` é a
única branch de produção e que o deploy automático de produção está desativado ou aponta só para
`main`.

### 2.6 Riscos remanescentes (do baseline §11, não endereçados nesta rodada)

- **`mimeType` armazenado confiado pelo endpoint de download** (§11.4) — hoje neutralizado por
  `Content-Disposition: attachment` + `nosniff`, mas a uma mudança de distância de um XSS via
  tipo de conteúdo armazenado.
- **CSP raiz permite `script-src 'unsafe-inline'`** (§11.5) — necessário hoje para o script
  inline de `public/index.html`. O novo app React (`web/`) **não precisa disso** (só usa
  `<script type="module" src="...">` externo, confirmado no HTML gerado) — dá para apertar a
  CSP quando/se `public/index.html` for descontinuado ou reescrito sem script inline.
- **`BlobVaultService.deleteAllActiveFiles()`** (§11.7) — continua no código, sem chamador em
  lugar nenhum. Não removi nem protegi nesta rodada (fora do escopo desta auditoria específica);
  recomendo remover ou colocar atrás do boundary de admin com confirmação explícita.

### 2.7 Interface React (Gate 5, metade UI — antes ausente, agora implementada)

App novo em `web/` (Vite + React + TypeScript), build para `public/app/` — `public/index.html`
(navegador do vault) continua parado, sem alteração, como o DEC-002 exige.

**Telas**: Login/logout, bootstrap do primeiro projeto (quando não há sprint ainda), Today
(entrega dominante, próxima ação, em andamento, bloqueadas), Sprint/Kanban (5 colunas do
contrato, criar/editar tarefa, mover via `<select>` acessível por teclado em vez de
drag-and-drop por ponteiro — ver limitação abaixo).

**Regras de produto do `AGENTS.md` seguidas**: máx. 3 passos no formulário de criação, densidade
de informação baixa, colunas do board em CSS grid que reorganizam em vez de rolar horizontalmente
(verificado em viewport de 375px), foco visível, `prefers-reduced-motion` respeitado, folha de
estilo de impressão básica.

**Testes**:
- Componente (vitest + jsdom + Testing Library): 8 testes — Login, TaskForm, gate de sessão do App.
- **E2E com browser real** (Playwright, Chromium pré-instalado deste ambiente): 4 testes rodando
  contra um mock leve do backend (`web/e2e/mock-server.ts`, sem precisar de `netlify dev`) que
  serve o build real da aplicação — login → bootstrap → board → criar/mover/editar tarefa →
  logout, mais checagem de "sem rolagem horizontal" em 375px e navegação só por teclado.
- **Acessibilidade**: `axe-core` rodou em 6 pontos do fluxo e2e (login, bootstrap, today, board,
  formulário de tarefa). Achou e eu corrigi **uma violação real**: a tela de login não tinha
  landmark `<main>` (regra `landmark-one-main`). Depois da correção, zero violações em todas as
  6 checagens.
- **Bug real encontrado e corrigido durante os testes** (não só um ajuste de teste): os campos
  tinham `required` nativo do HTML, que intercepta o submit antes do JavaScript do formulário
  rodar — as mensagens de erro customizadas (`role="alert"`) nunca apareciam quando um campo
  obrigatório estava vazio. Troquei por `aria-required` + validação 100% em JS nos três
  formulários (Login, TaskForm, FirstProjectSetup).

**Limitações conhecidas** (documentadas, não corrigidas nesta rodada):
- Mover cartão é feito por um `<select>` "Mover para", não por arrastar-e-soltar com ponteiro.
  Escolha deliberada: acessível por teclado por padrão, sem dependência de biblioteca de DnD.
- Não há lista/seletor de projetos — só o sprint "atual" é mostrado (a próxima sprint ativa ou
  planejada). Suficiente para o fluxo de um único operador do MVP.
- Revisão de propostas de decomposição (`desk_os_prepare_decomposition`/`apply_decomposition`)
  não tem tela própria ainda — só acessível via MCP/API diretamente.
- Impressão A4 é uma folha `@media print` básica, não um layout dedicado.

---

## Arquivos alterados nesta rodada de auditoria (§2)

```
src/lib/vault.mts                       # guard central de _desk-os/, ReDoS
src/lib/http.mts                        # safeError sem vazamento
src/repository/vault-adapter.mts        # allowReservedPaths: true
netlify/functions/vault-import.mts      # filter pré-inflação (zip-bomb), setVaultStoreForTesting
src/mcp-server.mts                      # guard de _desk-os/ automático via vault.mts; 1 fix de lint (regex)
src/application/desk-os-service.mts     # 1 fix de lint (import não usado)
scripts/smoke-oauth.mjs                 # login antes das checagens de vault
.env.example                            # SMOKE_BASE_URL / SMOKE_ADMIN_PASSWORD
.eslintrc.json, package.json            # lint funcional, vitest patch, scripts novos
vitest.config.mts                       # exclui web/ da descoberta de testes da raiz
netlify.toml, .github/workflows/ci.yml  # build/test/lint também para web/
web/**                                  # app React novo (Gate 5, metade UI)
tests/reserved-path-guard.test.ts       # novo
tests/http-safe-error.test.ts           # novo
tests/search-redos.test.ts              # novo
tests/zip-bomb-guard.test.ts            # novo
tests/repository.test.ts                # 1 linha ajustada (allowReservedPaths na simulação)
tests/dashboard.test.ts                 # (já ajustado no ciclo anterior ao Gate 0.5)
docs/GATE_PROGRESS.md                   # este arquivo
```

## Testes executados e resultado final

| Suíte | Comando | Resultado |
| --- | --- | --- |
| Backend — build | `npm run typecheck` | limpo |
| Backend — testes | `npm test` | **16 arquivos / 97 testes**, todos verdes |
| Backend — lint | `npm run lint` | limpo, 0 avisos |
| Backend — build final | `npm run build` | limpo |
| Backend — smoke | `npm run test:smoke` | **LACUNA** — requer `netlify dev` (ver §2.3); falha com mensagem clara e esperada (`SMOKE_BASE_URL is required`), não um erro silencioso |
| Web — build | `npm run build` (em `web/`) | limpo, gera `public/app/` |
| Web — testes de componente | `npx vitest run` (em `web/`) | **3 arquivos / 8 testes**, todos verdes |
| Web — lint | `npm run lint` (em `web/`) | limpo, 0 avisos |
| Web — e2e + acessibilidade | `npx playwright test` (em `web/`) | **4 testes**, todos verdes, 6 checagens de acessibilidade sem violações |
| `npm install` (raiz) | — | limpo, 0 vulnerabilidades |
| `npm install` (web/) | — | limpo, 0 vulnerabilidades |

**Total: 20 arquivos de teste (16 backend + 3 componentes web + 1 e2e web), 109 testes
automatizados, todos verdes**, mais 6 checagens de acessibilidade em browser real sem violações.

## Confirmação: produção não foi alterada

Nenhum `netlify deploy` foi executado. Todo trabalho ficou em commits na branch
`claude/executar-ai-desk-os-migration-ctul7o` (a branch do PR draft #1), nunca em `main`. Não fiz
merge. As únicas ações de rede foram: instalação de pacotes npm (registro público), leitura do
repositório GitHub, e criação/atualização do PR draft — nenhuma delas afeta o site de produção
do Netlify.

## Recomendação

**CORRIGIR** — não porque o núcleo técnico esteja errado (as 24 suítes de teste, incluindo
segurança e acessibilidade, estão verdes), mas porque duas ações **fora do meu alcance nesta
sessão** ainda bloqueiam um Deploy Preview útil:

1. Definir `ADMIN_PASSWORD` (e confirmar `MCP_JWT_SECRET`/`PUBLIC_BASE_URL`) nas variáveis de
   ambiente do site no Netlify — sem isso, o login falha fechado e nada pode ser testado
   manualmente no preview.
2. Confirmar manualmente, no painel do Netlify, que a branch `claude/executar-ai-desk-os-migration-ctul7o`
   dispara só Deploy Preview e que `main` é a única branch de produção com auto-publish — eu não
   tenho acesso a essa configuração para verificar por conta própria.

Depois dessas duas confirmações suas, meu próximo passo recomendado seria **AVANÇAR** para um
Deploy Preview real e um passe manual pelo app publicado (o `test:smoke` completo só pode rodar
contra um servidor vivo, que este ambiente não consegue iniciar).
