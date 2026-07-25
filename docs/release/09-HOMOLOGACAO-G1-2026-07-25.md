# 09 — Homologação e Fechamento G1 — 2026-07-25

## Resultado executivo

O ponto interrompido pelo Manus foi retomado, corrigido e homologado. O hotfix
do visualizador Vault já estava incorporado diretamente ao `main`; por isso o
PR #14 foi encerrado como **superseded**, sem merge. O PR #9 também foi
encerrado porque sua solução de autenticação estava superada pela arquitetura
atual. O roadmap G0–G10 foi integrado pelo PR #11, a homologação e as decisões
foram incorporadas pelo PR #15 e a migração documental Netlify → Vercel foi
concluída pelo PR #16.

**Decisão do gate:** **G1 APROVADO**.

O runtime, a infraestrutura, a fonte única do MCP e a orientação operacional
para agentes estão estabilizados. Isso autoriza avançar para o G2, mas não
autoriza beta público com dados privados: o workspace compartilhado continua
sendo uma exceção temporária para MVP interno e demonstrações controladas.

## Estado confirmado

| Item | Estado | Evidência |
|---|---|---|
| Repositório | Operacional | `oexecutor/Executar.ai`, branch `main` |
| Visualizador Vault | Homologado | deep link, aba Documentos, leitura por `path`, conteúdo e download |
| Produção Vercel | READY | projeto `executar-ai` |
| API de identidade | 200 | `/api/auth/me` retorna workspace público |
| API de projetos | 200 | `/api/executar/projects` retorna o portfólio |
| Vault status | 200 | 5 arquivos; armazenamento Vercel Postgres |
| Vault listagem | 200 | `/api/vault/files` retorna entradas e `viewUrl` |
| Vault arquivo | 200 | `evidence.json` retornado por `path` |
| MCP | Protegido e operacional | `/mcp` retorna 401 + `WWW-Authenticate`, sem 500 |
| Erros Vault | Nenhum encontrado | janela de 24 horas na Vercel |
| PR #14 | Encerrado sem merge | implementação equivalente e mais recente já está no `main` |
| PR #9 | Encerrado sem merge | branch de autenticação obsoleta |
| PR #11 | Integrado | roadmap G0–G10 e pacote operacional |
| PR #15 | Integrado | homologação e decisões de infraestrutura |
| PR #16 | Integrado | regras de agentes, segurança e deploy atualizadas para Vercel |
| PR #4 | Draft preservado | AMES aguardando migração para a suíte de plugins, sem merge no app |

## Sequência executada

1. O PR #14 foi comparado ao `main`; a implementação funcional já existia no
   `main` com refinamentos adicionais de estilo.
2. Produção e rotas do Vault foram consultadas diretamente na Vercel.
3. O PR #14 recebeu registro de homologação e foi encerrado sem merge.
4. O PR #9 foi comparado ao `main`, classificado como obsoleto e encerrado.
5. O PR #11 foi promovido de draft e mesclado por squash, adicionando roadmap,
   backlog, gates, testes, rollback e operação pós-lançamento.
6. As decisões de autenticação, persistência e MCP foram registradas e
   integradas pelo PR #15.
7. `AGENTS.md`, `SECURITY.md`, `docs/DEPLOYMENT_STATUS.md`,
   `docs/09_SECURITY_AND_GOVERNANCE.md` e
   `docs/13_DECISIONS_GAPS_ASSUMPTIONS.md` foram atualizados e integrados pelo
   PR #16.
8. O PR #4 recebeu orientação de governança para migrar AMES à suíte de
   plugins antes de ser encerrado sem merge.

## Decisões vigentes

- **Autenticação:** workspace público somente para desenvolvimento interno e
  demonstrações controladas; autenticação e isolamento obrigatórios antes do
  beta público.
- **Persistência:** manter o contrato atual até G3; Vault/OAuth em Vercel
  Postgres/Neon, Supabase apenas onde já estiver configurado; nenhuma migração
  sem ADR, teste de integridade e rollback.
- **MCP:** a rota nativa deste repositório é a única fonte de verdade. O
  servidor standalone não integra o produto principal.
- **Documentação operacional:** `docs/release/`, `AGENTS.md` e `SECURITY.md`
  prevalecem sobre documentos históricos.
- **AMES:** pertence à fonte de verdade da suíte de plugins, não ao runtime do
  aplicativo.

## Condição de saída do G1

- [x] produção Vercel responde sem erro 500 nos fluxos homologados;
- [x] Vault e visualizador de deep link homologados;
- [x] MCP nativo confirmado como fonte única;
- [x] PRs obsoletos resolvidos;
- [x] decisões de autenticação e persistência registradas;
- [x] orientações Netlify substituídas nos documentos operacionais principais;
- [x] roadmap e runbooks integrados ao `main`.

## Próxima ação única

Executar o **G2 — ciclo central do produto funcional**, validando em produção:
entrada de contexto → estruturação → criação do projeto → fases e tarefas →
próxima ação → checkpoints → evidência → painel/exportação → persistência →
recuperação.
