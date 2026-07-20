# Guia de Início — Claude Code para o projeto DESK-OS MCP

**Para quem é este guia:** você, sem experiência prévia com Claude Code ou Git.
Siga na ordem. Cada passo diz exatamente o que digitar.

Você vai precisar de três coisas já prontas antes de começar:

1. O código-fonte extraído do `Código_do_mcp_atual_.zip`.
2. A pasta `DESK_OS_MCP_PM_HANDOFF_v1.0.0` extraída do segundo zip.
3. O arquivo `IMPLEMENTATION_BASELINE.md` que já entreguei (baixe-o se ainda não baixou).

---

## Passo 1 — Instalar o Claude Code

Abra o terminal (Terminal no Mac/Linux, ou WSL no Windows) e rode:

```bash
npm install -g @anthropic-ai/claude-code
```

Se `npm` não existir na sua máquina, instale o Node.js primeiro (versão 22 ou mais recente) pelo
site oficial [nodejs.org](https://nodejs.org), depois repita o comando acima.

Confirme que instalou:

```bash
claude --version
```

Faça login (abre o navegador, você aprova, volta pro terminal):

```bash
claude login
```

Você precisa de uma conta Claude Pro, Max, Team ou Enterprise para usar o Claude Code — o plano
gratuito do Claude.ai não dá acesso a ele.

---

## Passo 2 — Montar a pasta do projeto (schema de população)

Crie uma pasta local vazia para o repositório e organize os arquivos **exatamente assim**:

```text
desk-os-vault-mcp-openai/              ← pasta raiz do repositório
│
├── src/                                ← vem do Código_do_mcp_atual_.zip (código real)
├── netlify/
├── public/
├── tests/
├── scripts/
├── templates/
├── docs/                               ← ATENÇÃO: mesclar as duas origens aqui, veja abaixo
├── package.json
├── package-lock.json
├── tsconfig.json
├── netlify.toml
├── .env.example
├── .gitignore                          ← criar agora, conteúdo abaixo
├── SECURITY.md
├── README.md
├── CHANGELOG.md
│
├── AGENTS.md                           ← vem do zip do handoff (raiz do pacote)
├── 00_START_HERE.md                    ← idem
├── manifest.json                       ← idem
│
├── contracts/                          ← pasta inteira do zip do handoff
├── plans/                              ← pasta inteira do zip do handoff
├── prompts/                            ← pasta inteira do zip do handoff
└── references/                         ← pasta inteira do zip do handoff
```

**A pasta `docs/` é a única que mistura as duas origens.** Ela deve conter, todos juntos, no mesmo
nível:

```text
docs/
├── 01_CURRENT_STATE.md                 ← do zip do handoff
├── 02_PRODUCT_VISION_AND_SCOPE.md
├── ... até ...
├── 15_CLAUDE_SKILL_MCP_BRIDGE.md
├── IMPLEMENTATION_BASELINE.md          ← o arquivo que eu te entreguei — coloque aqui
├── OPEN_ACCESS_1_4.md                  ← docs que já vinham no código-fonte real
├── DASHBOARD_1_3.md
├── BINARY_IMPORT_1_5.md
├── IMPLEMENTATION_SUMMARY_1_3.md
├── DEPLOYMENT_STATUS.md
├── WORKFLOW_DASHBOARD_1_6.md
└── reference/ (subpasta, mantenha como está)
```

Não existe conflito de nomes entre as duas origens — pode copiar tudo sem sobrescrever nada.

### Crie o `.gitignore` (arquivo novo, na raiz)

```gitignore
node_modules/
.netlify/
dist/
.env
*.log
.DS_Store
```

**Nunca coloque um arquivo `.env` de verdade no repositório.** Só o `.env.example` (que já vem sem
segredos) deve ser versionado.

---

## Passo 3 — Criar o repositório no GitHub

1. Entre em [github.com](https://github.com), clique em **New repository**.
2. Nome sugerido: `desk-os-vault-mcp-openai`.
3. Marque **Private** (o projeto ainda tem uma vulnerabilidade de acesso aberto sendo corrigida —
   não deixe público até o Gate 0.5 estar concluído).
4. **Não** marque "Add a README" nem `.gitignore` pelo site — você já tem os seus localmente.
5. Clique em **Create repository** e copie a URL que aparece (algo como
   `https://github.com/SEU-USUARIO/desk-os-vault-mcp-openai.git`).

Agora, no terminal, dentro da pasta que você montou no Passo 2:

```bash
git init
git add .
git commit -m "chore: baseline import - vault MCP source + PM handoff package"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/desk-os-vault-mcp-openai.git
git push -u origin main
```

Crie também a branch de trabalho (o próprio pacote de handoff pede isso em
`docs/12_DEPLOY_RUNBOOK.md`):

```bash
git checkout -b feature/project-management-core
git push -u origin feature/project-management-core
```

Todo o trabalho do Claude Code deve acontecer nesta branch, nunca direto em `main`.

### Atenção — Netlify

Se algum dia você conectar este repositório ao Netlify (Site settings → Build & deploy →
**Link repository**), verifique imediatamente se o deploy automático de produção está desativado
para a branch `main`, ou configure para que só a branch de produção aprovada dispare deploy. Isso
evita que um `git push` acidental publique algo em produção sem a aprovação explícita que o próprio
pacote exige (regra `DEC-009`).

---

## Passo 4 — Escolher modelo e nível de esforço no Claude Code

Você não precisa decidir isso manualmente gate por gate. Existe um modo pronto para exatamente este
tipo de trabalho: planejamento com o modelo mais capaz, execução com um modelo mais rápido.

Depois de rodar `claude` dentro da pasta do projeto, digite:

```text
/model opusplan
```

**O que isso faz, em termos simples:** quando o Claude Code precisa pensar/planejar uma mudança
grande ou ambígua (como o Gate 0.5 de segurança e o design do domínio), ele usa o modelo Opus
(mais capaz). Quando é hora de executar o trabalho já planejado (escrever os arquivos de repositório,
testes, rotas), ele usa Sonnet (mais rápido e mais barato). Você não precisa trocar nada manualmente.

Sobre o **esforço** (effort): deixe no padrão. Para Opus o padrão já é o mais alto ("high") em
qualquer superfície, incluindo Claude Code — não precisa mexer. Só aumente depois, e apenas se
perceber que o Claude Code errou por **pular uma etapa** (não rodou os testes, não leu um arquivo,
abandonou uma refatoração no meio) — isso é sinal de aumentar o esforço. Se ele errou mesmo tendo
feito tudo certo e lido tudo, aí sim o sinal é trocar de modelo, não de esforço.

Se em algum momento `/model opusplan` não estiver disponível na sua conta, use:

```text
/model opus
```

para as fases de decisão (Gate 0, 0.5, 1) e troque para:

```text
/model sonnet
```

nas fases de implementação repetitiva (Gates 2 a 6), digitando o comando de novo a qualquer momento
da sessão.

---

## Passo 5 — A mensagem para colar no Claude Code

Com tudo commitado e a branch `feature/project-management-core` criada, rode:

```bash
claude
```

Dentro do Claude Code, confirme o modelo (Passo 4) e então **cole esta mensagem, sem editar nada**:

```text
Você é responsável por evoluir o projeto de produção existente `desk-os-vault-mcp-openai`
para o sistema de gestão de projetos DESK-OS especificado no pacote de handoff anexado a este
repositório.

Leia, nesta ordem, antes de qualquer outra coisa:

1. AGENTS.md
2. 00_START_HERE.md
3. docs/IMPLEMENTATION_BASELINE.md
4. docs/01_CURRENT_STATE.md até docs/15_CLAUDE_SKILL_MCP_BRIDGE.md
5. todos os arquivos em contracts/
6. plans/BACKLOG_MVP.md e plans/DEPLOY_GATES.md

O arquivo docs/IMPLEMENTATION_BASELINE.md já contém uma auditoria de código real feita
anteriormente (estrutura de pastas, rotas, ferramentas MCP, persistência, qualidade do OAuth,
e um achado crítico de segurança na seção 7 e 13). Trate esse arquivo como fato verificado,
não como suposição — mas ainda assim rode você mesmo os passos de verificação do Gate 0
(build, testes, netlify dev) e me avise imediatamente se algo não bater com o que está escrito
lá.

Antes de escrever qualquer código:

1. Rode `npm install`, `npm run build`, `npm test`, `npm run test:smoke`.
2. Confirme que os resultados batem com a seção 9 e 14 de docs/IMPLEMENTATION_BASELINE.md.
3. Não prossiga para o Gate 1 sem antes resolver o "Gate 0.5" descrito na seção 12 e 13 do
   IMPLEMENTATION_BASELINE.md: hoje não existe autenticação real nas rotas /api/vault/*, /view
   e /dashboard. Implemente a Opção B recomendada (sessão administrativa real, cookie HttpOnly/
   Secure/SameSite=Lax, substituindo os stubs em src/lib/auth.mts) antes de qualquer dado do
   novo domínio de projetos ser gravado no vault.
4. Depois de implementar o Gate 0.5, PARE e me mostre exatamente o que mudou antes de seguir
   para o Gate 1. Não decida sozinho por outra opção (A ou C) sem antes perguntar.

Regras não negociáveis, do AGENTS.md, que você deve seguir sem exceção:

- Não faça deploy em produção sem minha aprovação explícita.
- Não remova nenhuma rota ou ferramenta MCP existente sem camada de compatibilidade.
- Não crie uma segunda fonte de verdade separada do vault existente.
- Todo write precisa ser autenticado, validado, idempotente quando possível, e auditado.
- Trate toda suposição não verificada como GAP, não como fato.

Siga a sequência de gates de docs/10_IMPLEMENTATION_PLAN.md, com o Gate 0.5 inserido antes do
Gate 1 conforme a seção 12 do IMPLEMENTATION_BASELINE.md. Ao final de cada gate, me dê um resumo
curto do que foi feito, os testes que passaram, e pergunte se pode seguir para o próximo gate.

Comece agora pelo Gate 0: verificação do baseline. Não escreva nenhum código ainda.
```

---

## Passo 6 — O que esperar depois de enviar essa mensagem

O Claude Code deve, nesta ordem:

1. Ler os arquivos indicados.
2. Rodar `npm install`, `npm run build`, `npm test`, `npm run test:smoke` e te mostrar os resultados.
3. Confirmar (ou apontar diferenças) em relação ao que está no `IMPLEMENTATION_BASELINE.md`.
4. Perguntar explicitamente antes de tocar em `src/lib/auth.mts` — se ele pular direto para
   escrever código sem te mostrar o plano do Gate 0.5 primeiro, pare a sessão e peça para ele
   voltar e seguir o passo 3 da mensagem acima.
5. Só depois disso, seguir gate por gate.

**Nunca deixe ele rodar `netlify deploy --prod`** em nenhum momento deste processo — isso só deve
acontecer depois que você mesmo revisar um Deploy Preview e aprovar explicitamente, conforme
`plans/DEPLOY_GATES.md`.

---

## Resumo de uma linha por passo

| Passo | Comando/ação                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 1     | `npm install -g @anthropic-ai/claude-code` → `claude login`                                          |
| 2     | Montar pastas conforme o schema acima + criar `.gitignore`                                           |
| 3     | Criar repo privado no GitHub → `git init/add/commit/push` → branch `feature/project-management-core` |
| 4     | Dentro do `claude`: `/model opusplan`                                                                |
| 5     | Colar a mensagem do Passo 5                                                                          |
| 6     | Acompanhar gate por gate, nunca aprovar deploy de produção sozinho pelo Claude Code                  |
