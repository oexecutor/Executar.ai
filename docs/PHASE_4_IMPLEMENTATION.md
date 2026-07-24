# Fase 4 — Integração funcional e Preview

Data da consolidação: 23 de julho de 2026.

## Resultado

A Fase 4 transforma o repositório anterior em uma fundação funcional do EXECUTA.AI sem substituir indiscriminadamente suas camadas maduras.

Foram promovidos:

- o motor canônico 3–9–36 para `src/executar`;
- 11 ferramentas MCP `executar_*`;
- a API canônica `/api/executar/*`;
- autenticação Supabase com sessão curta de aplicação;
- escopo obrigatório de workspace;
- persistência Supabase compatível com RLS;
- landing React pública e workspace PWA autenticado;
- visualizações Visão geral, Hoje, Portfólio, Projeto, Kanban e Documentos;
- a API `/api/pm/*` e o vault existentes como camada de compatibilidade.

## Decisões de canonização

| Camada | Ativo promovido | Regra |
| --- | --- | --- |
| Produto | metodologia 3 fases, 9 áreas, 36 itens | contrato obrigatório |
| Experiência | JSX e referências do EXECUTA Studio | referência de composição e operação |
| Visual | identidade cinza, laranja, preto e branco | autoridade visual |
| Método visual | Forge Visual Canvas | guia para composição premium e responsiva |
| Integração legada | `/api/pm/*`, vault e workflows | preservar capacidade durante a migração |
| Dados | Supabase Postgres | mesma origem para PWA, APIs e MCP |
| Segurança | Supabase Auth, memberships, RLS e sessão assinada | falhar fechado |

Tokens CSS foram reconstruídos a partir da identidade aprovada e do método do Forge. Eles permanecem derivados e versionados; não substituem a paleta e a identidade como fonte visual de autoridade.

## Fluxo de dados

```text
Usuário → Supabase Auth → membership ativa → workspace
                                       │
                  ┌────────────────────┴───────────────────┐
                  ▼                                        ▼
           PWA + APIs HTTP                         OAuth + MCP
                  └──────────────┬─────────────────────────┘
                                 ▼
                    serviços e motor EXECUTA
                                 ▼
                  kv_store(workspace_id, namespace, key)
                                 │
                   projetos, progresso, vault e evidências
```

O `workspace_id` participa da autenticação, do namespace de armazenamento e dos tokens MCP. Um projeto criado pelo MCP é lido pelo aplicativo na mesma chave canônica.

## Segurança implementada

- acesso público ao painel e ao vault removido;
- autenticação por Supabase validada no servidor;
- memberships `OWNER`, `ADMIN`, `EDITOR` e `VIEWER`;
- mutações HTTP bloqueadas para `VIEWER`;
- membership do MCP revalidada no Supabase ao emitir e usar tokens;
- MCP bloqueado para membership somente leitura enquanto não houver catálogo granular de scopes;
- sessão de aplicação em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS;
- `SUPABASE_SERVICE_ROLE_KEY` restrita ao servidor;
- CSP, `frame-ancestors`, `nosniff`, política de permissões e cache privado;
- chaves de IA não são aceitas no navegador;
- importação ZIP conserva limites contra zip bomb e caminhos reservados;
- reset e exclusão exigem `confirm=true`.

## Banco e migração

Arquivo:

```text
supabase/migrations/202607230001_phase4_workspace_rls.sql
```

Objetos principais:

- `public.workspaces`;
- `public.workspace_memberships`;
- `public.kv_store`;
- `public.oauth_kv_store`, isolado do PostgREST público;
- `app.is_active_workspace_member`;
- `app.has_workspace_role`;
- políticas RLS explícitas;
- trigger `on_auth_user_created_create_workspace`.

A migração incluída no repositório não significa que tenha sido aplicada em um banco remoto. Antes do Preview autenticado:

1. criar backup ou usar um projeto Supabase de Preview;
2. executar `supabase db push --dry-run`;
3. revisar conflitos com tabelas preexistentes;
4. aplicar a migração;
5. executar `supabase test db`;
6. criar duas contas e comprovar isolamento cruzado;
7. só então configurar as variáveis no Vercel Preview.

Compatibilidade: quando encontra o `kv_store` legado sem `workspace_id`, a
migração renomeia a tabela para `legacy_kv_store`, copia apenas os namespaces
OAuth para `oauth_kv_store` e preserva o restante sem conversão automática.
Projetos e arquivos legados exigem mapeamento explícito para o workspace de
destino; nenhuma atribuição de proprietário é inferida.

## API canônica

| Método | Rota | Capacidade |
| --- | --- | --- |
| `GET` | `/api/executar/projects` | listar projetos |
| `POST` | `/api/executar/validate` | validar contrato sem persistir |
| `POST` | `/api/executar/projects` | criar/importar projeto |
| `GET` | `/api/executar/projects/:id` | ler projeto, progresso e status |
| `GET` | `/api/executar/projects/:id/status` | obter dashboard calculado |
| `GET` | `/api/executar/projects/:id/next` | obter fila de execução |
| `POST` | `/api/executar/projects/:id/actions/:actionId` | concluir/reabrir ação |
| `POST` | `/api/executar/projects/:id/checkpoints/:checkpointId` | validar/reabrir checkpoint |
| `GET` | `/api/executar/projects/:id/export` | exportar pacote portátil |
| `POST` | `/api/executar/projects/:id/reset` | limpar progresso com confirmação |
| `DELETE` | `/api/executar/projects/:id` | excluir com confirmação |

## Superfícies do front-end

- `/`: landing pública;
- `/entrar`: login, cadastro e seleção de workspace;
- `/app`: shell autenticado;
- Visão geral: métricas e projeto dominante;
- Hoje: próxima ação e fila;
- Portfólio: listar, criar e importar;
- Projeto: Plano, Lista e Tabela;
- Kanban: estado derivado das ações e checkpoints;
- Documentos: arquivos e notas do vault.

O service worker não armazena respostas privadas de `/api`, `/mcp`, `/oauth`, `/view` ou `/dashboard`.

## Verificação

Comandos obrigatórios:

```bash
npm run build
npm test
npm run lint
npm --prefix web run build
npm --prefix web test
npm --prefix web run lint
npm --prefix web run test:e2e
```

O CI instala o Chromium e executa jornada pública, teclado, workspace autenticado, atualização de ação, acessibilidade crítica e responsividade.

## Gate para lançamento

Esta fase autoriza apenas PR e Vercel Preview. Produção exige:

- Preview `READY`;
- migração Supabase aplicada e testada no ambiente correto;
- variáveis de Preview confirmadas;
- login, cadastro e recuperação de sessão homologados;
- teste com dois workspaces sem vazamento;
- criação pelo MCP aparecendo no PWA;
- criação no PWA consultável pelo MCP;
- importação/exportação do vault homologadas;
- observabilidade e alertas configurados;
- rollback ensaiado;
- aprovação humana registrada.

## Rollback

Antes da produção:

- não fazer merge;
- fechar o PR;
- remover o Preview se necessário;
- não alterar o banco de produção.

Depois da produção:

- reverter o commit de release;
- promover a versão Vercel anterior;
- executar somente migrações reversíveis já ensaiadas;
- restaurar o backup quando houver alteração destrutiva de dados.
