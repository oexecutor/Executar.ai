# MASTER INDEX E RELATÓRIO DE AUDITORIA — GITHUB × VERCEL

**Conta GitHub:** `oexecutor`  
**Equipe Vercel:** `oexecutor-9118s-projects`  
**Data de corte:** 27 de julho de 2026, 20:05 BRT  
**Objetivo:** identificar PRs pendentes, divergências entre GitHub e Vercel e bloqueios para lançamento.

---

## 1. Decisão executiva

**Status geral: CORRIGIR antes do lançamento.**

Não existe uma fila extensa de PRs atrasados. Há **somente 1 PR aberto** em todos os cinco repositórios auditados.

Esse PR, `P1.Executar.ai #4`, **não deve ser mesclado no aplicativo**. A revisão de governança determina que o pacote AMES seja migrado para a suíte de plugins e, depois, o PR seja encerrado sem merge.

O bloqueio mais urgente está no `P2.executar.business`: o PR #2 foi mesclado na `main`, mas o deployment Git-linked no Vercel falhou porque o Root Directory não aponta para `apps/vercel-personal`. Existe um segundo projeto Vercel saudável, porém sem metadados Git no deployment, o que não comprova automação GitHub → Vercel.

---

## 2. Master index

| ID | Repositório GitHub | Visibilidade | Papel auditado | PRs abertos | Vercel correlacionado | Estado de lançamento |
|---|---|---:|---|---:|---|---|
| R1 | `oexecutor/P1.Executar.ai` | Público | Aplicativo principal EXECUTA.AI e runtime editorial/MCP | 1 | `executar-ai`; `executa-journal-preview` | **Operacional com pendência de governança no PR #4** |
| R2 | `oexecutor/P2.executar.business` | Público | Servidor pessoal, dashboard, Studio e MCP | 0 | `p2.executar.business`; `p2-executar-business` | **Bloqueado: deploy automático da main falhou e há duplicidade** |
| R3 | `oexecutor/P3.Portifolio` | Privado | Portfólio e exportações de plugins | 0 | Nenhum | **Sem bloqueio de PR; 2 PRs temporários fechados sem merge por desenho** |
| R4 | `oexecutor/P4.Docs` | Privado | Repositório documental | 0 | Nenhum | **Vazio/sem integração de lançamento identificada** |
| R5 | `oexecutor/Executar-Suites` | Privado | Destino provável da suíte de plugins | 0 | Nenhum | **Vazio; pacote AMES ainda não localizado** |

---

## 3. Auditoria dos pull requests

### 3.1 PR aberto — `P1.Executar.ai #4`

**Título:** `feat(ames): Adaptive Multi-format Editorial System skill package`

| Verificação | Resultado |
|---|---|
| Estado | Open |
| Draft | Sim |
| Mergeável tecnicamente | Sim |
| Branch | `claude/adaptive-editorial-system-ljgzc1` |
| Base | `main` |
| Tamanho | 88 arquivos; 3.589 adições; 0 exclusões |
| Divergência | 3 commits à frente e 50 commits atrás da `main` |
| CI GitHub | Sucesso no workflow CI |
| Status externo | Preview Netlify com sucesso |
| Preview Vercel comprovado | Não identificado |
| Revisores solicitados | Nenhum |
| Threads pendentes | Nenhuma |
| Decisão de governança | **Não mesclar no runtime do aplicativo** |

**Ação correta:** copiar e validar o pacote AMES na suíte de plugins, confirmar manifestos, checksums e testes e, somente depois, **fechar o PR #4 sem merge**.

**Risco de merge direto:** mistura especificações proprietárias de plugin com a fonte de verdade do runtime de produção e insere um pacote desatualizado em relação a 50 commits já incorporados à `main`.

### 3.2 `P2.executar.business #2`

**Estado:** fechado e mesclado em 27/07/2026.  
**Commit da main:** `23c7ca8a25b59c7753063daccc05f169d46307c5`.

O código passou typecheck, build e Playwright antes do merge, mas o deployment automático posterior falhou no Vercel.

### 3.3 `P3.Portifolio #1` e `#2`

Ambos foram fechados sem merge. Os próprios PRs declaram que eram temporários para disparar workflows de exportação e não deveriam ser mesclados.

**Classificação:** encerrados corretamente; não são atraso.

---

## 4. Correlação GitHub × Vercel

### 4.1 `P1.Executar.ai`

| Projeto Vercel | Origem Git | Branch/SHA mais recente | Deployment | Avaliação |
|---|---|---|---|---|
| `executar-ai` | `oexecutor/P1.Executar.ai` | `main` / `638b28bc...` | READY, production | Saudável |
| `executa-journal-preview` | `oexecutor/P1.Executar.ai` | `main` / `638b28bc...` | READY, production | Saudável |

Os dois projetos receberam o mesmo commit da `main` e os dois status Vercel estão verdes.

### 4.2 `P2.executar.business`

| Projeto Vercel | Origem Git | Deployment | Problema |
|---|---|---|---|
| `p2.executar.business` | Git-linked a `oexecutor/P2.executar.business`, branch `main` | ERROR | Root Directory incorreto; Vercel não encontrou Next.js na raiz |
| `p2-executar-business` | Deployment sem metadados Git | READY | Não comprova deploy automático a partir da `main` |

**Erro confirmado no build:**

> No Next.js version detected. Check whether the Root Directory matches the directory containing `package.json`.

O PR mesclado define explicitamente o Root Directory correto como:

`apps/vercel-personal`

---

## 5. Achados por severidade

### CRÍTICO — RSK-01: deployment pós-merge do P2 falhou

A `main` contém o código novo, mas o projeto Git-linked não consegue construir. O lançamento automático está interrompido.

**Correção:** configurar `p2.executar.business` com Root Directory `apps/vercel-personal` e redeployar a `main`.

### ALTO — RSK-02: dois projetos Vercel representam o mesmo P2

Há um projeto Git-linked quebrado e outro manual saudável. Isso cria duas fontes operacionais e risco de domínio, variáveis e deploys divergirem.

**Correção:** escolher um único projeto canônico. A opção mais segura é recuperar o projeto Git-linked, validar e depois arquivar/remover o duplicado somente após confirmar domínios e variáveis.

### ALTO — RSK-03: PR #4 está no repositório errado

O PR é mergeável, mas a governança já decidiu que ele pertence à suíte de plugins, não ao runtime.

**Correção:** migrar para `Executar-Suites` ou para o repositório sucessor formalmente definido; validar; fechar o PR sem merge.

### MÉDIO — RSK-04: suíte de plugins está vazia

`oexecutor/Executar-Suites` existe, mas não contém o AMES e aparece sem conteúdo/indexação. A referência anterior `HQ-EXECUTA-AI-PLUGIN-SUITE` não foi encontrada entre os repositórios instalados.

**Correção:** formalizar `Executar-Suites` como sucessor canônico ou criar/restaurar o repositório correto antes de encerrar o PR #4.

---

## 6. Ordem de execução recomendada

1. Corrigir o Root Directory do projeto Vercel Git-linked `p2.executar.business` para `apps/vercel-personal`.
2. Fazer redeploy da `main` e exigir estado `READY`.
3. Validar dashboard, Studio, persistência e MCP no domínio canônico.
4. Escolher o único projeto P2 oficial e desativar o duplicado apenas depois da validação.
5. Definir `Executar-Suites` como destino canônico da suíte ou restaurar o repositório correto.
6. Migrar o pacote AMES do PR `P1 #4`, preservando histórico e checksums.
7. Fechar o PR #4 sem merge.
8. Executar nova busca global e aceitar o gate somente quando houver `0 PRs abertos`, todos os deployments canônicos `READY` e nenhuma duplicidade operacional.

---

## 7. Gate de lançamento

| Critério | Estado |
|---|---|
| Zero PRs atrasados | **Não** — existe 1 PR aberto aguardando migração/encerramento |
| Main do aplicativo P1 implantada | **Sim** |
| Projetos P1 no Vercel verdes | **Sim** |
| Main do P2 implantada automaticamente | **Não** |
| Um único projeto Vercel por produto | **Não** |
| Suíte de plugins com AMES consolidado | **Não** |
| Repositórios documentais sem bloqueios | **Sim, mas dois estão vazios** |

**Decisão final:** `CORRIGIR`.

O projeto ainda não está limpo para lançamento. Não é necessário “mergear todos os PRs”; é necessário corrigir o P2, consolidar o Vercel e encerrar corretamente o PR #4 após a migração.
