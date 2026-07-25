# 09 — Homologação G1 — 2026-07-25

## Resultado executivo

O ponto interrompido pelo Manus foi retomado e homologado. O hotfix do
visualizador Vault já estava incorporado diretamente ao `main`; por isso o
PR #14 foi encerrado como **superseded**, sem merge. O PR #9 também foi
encerrado por estar superado pela arquitetura atual. O pacote completo de
roadmap e operação de release do PR #11 foi integrado ao `main`.

**Decisão do gate:** **G1 PARCIALMENTE APROVADO**.

A infraestrutura e o runtime estão operacionais. Permanecem no G1 apenas a
atualização dos documentos históricos (`AGENTS.md`, `SECURITY.md` e referências
Netlify) e a estabilização documental da fonte única de verdade.

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
| PR #9 | Encerrado sem merge | arquitetura de autenticação da branch estava obsoleta |
| PR #11 | Integrado | roadmap G0–G10 e pacote operacional adicionados ao `main` |

## Sequência executada

1. Comparação do PR #14 com o `main` confirmou branches divergentes, mas com o
   mesmo hotfix funcional já reimplementado e refinado no `main`.
2. Produção e rotas do Vault foram consultadas diretamente na Vercel.
3. O PR #14 recebeu registro de homologação e foi encerrado sem merge.
4. O PR #9 foi comparado ao `main`, classificado como obsoleto e encerrado.
5. O PR #11 foi promovido de draft, teve checks verdes e foi mesclado por
   squash, colocando o roadmap e os runbooks no repositório principal.
6. As decisões de autenticação, persistência e MCP foram registradas em
   `04-RISCOS-DECISOES.md`.

## Decisões vigentes

- **Autenticação:** workspace público apenas para desenvolvimento interno e
  demonstrações controladas; autenticação e isolamento obrigatórios antes do
  beta público.
- **Persistência:** manter o contrato atual até G3; Vault/OAuth em Vercel
  Postgres, Supabase apenas onde já estiver configurado; nenhuma migração sem
  ADR e rollback.
- **MCP:** a rota nativa deste repositório é a fonte única. O servidor
  standalone não integra o produto principal.

## Próxima ação única

Atualizar `AGENTS.md`, `SECURITY.md` e os documentos que ainda orientam agentes
para Netlify/senha de operador. Depois disso, executar o smoke test formal do
G1 e avançar para o **G2 — ciclo central do produto funcional**.
