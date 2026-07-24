# Matriz de paridade — Fase 4

Esta matriz impede que a migração visual elimine capacidades existentes silenciosamente.

| Capacidade | Origem funcional | Superfície canônica | Estado Fase 4 | Evidência |
| --- | --- | --- | --- | --- |
| Login e sessão | autenticação/OAuth anterior | `/entrar`, Supabase Auth | implementado | testes de auth e front-end |
| Múltiplos usuários | requisito PWA público | Supabase `auth.users` | implementado na arquitetura; requer migração remota | migration SQL |
| Múltiplos workspaces | novo requisito canônico | memberships + RLS | implementado na arquitetura; requer migração remota | migration e teste SQL |
| Listar projetos | `/api/pm/projects` | Portfólio + `/api/executar/projects` | implementado | teste da API canônica |
| Criar projeto | PM e Studio JSX | modal/importação JSON | implementado | teste da API canônica |
| Modelo 3–9–36 | motor EXECUTAR | `src/executar` | implementado | validação 3/9/36 e 81 ações |
| Próxima ação/Hoje | PM Today + Studio | página Hoje | implementado | motor e front-end |
| Plano por fases | Studio JSX | Projeto / Plano | implementado | build e E2E |
| Lista | experiência-alvo | Projeto / Lista | implementado | build |
| Tabela | experiência-alvo | Projeto / Tabela | implementado | build |
| Kanban | `pm-ui.mjs` | Kanban derivado do projeto | implementado | front-end e E2E |
| Mover/avançar item | PM task move | conclusão da próxima ação | implementado com semântica canônica | teste API |
| Checkpoint com gate | motor EXECUTAR | cartão de checkpoint | implementado | teste de gating |
| Progresso | motor/Studio | visão geral e projeto | implementado | teste do motor |
| Documentos | MCP/vault v1.2+ | página Documentos | implementado | testes do vault |
| Criar nota | vault | modal de nova nota | implementado | API protegida |
| Importar vault ZIP | vault | API/configurações legada | preservado; UI dedicada pendente | testes zip bomb |
| Exportar vault ZIP | vault | API/configurações legada | preservado; UI dedicada pendente | suíte do vault |
| Importar projeto JSON | Studio | Portfólio | implementado | validação canônica |
| Exportar projeto | motor | Projeto / Exportar | implementado | teste API |
| Dashboard de workflow | workflow dashboard | rota protegida `/dashboard` | preservado; incorporação visual pendente | testes de workflow |
| MCP do vault | MCP anterior | `/mcp` | preservado | testes MCP |
| MCP EXECUTA | motor anterior | 11 ferramentas `executar_*` | implementado | catálogo e testes do serviço |
| Auditoria PM | implementação anterior | `/api/pm/audit` | preservado; tela dedicada pendente | testes PM |
| PWA | app anterior | manifest + service worker | implementado | build |
| Landing pública | landing/business/Forge | `/` | implementado | build e E2E |
| Recuperação de senha | Supabase Auth | `/entrar` | pendente para Fase 5 | decisão de produto |
| Convites/membros | memberships | administração de workspace | banco pronto; UI pendente | migration SQL |
| Billing | não canônico no pacote | futura área de conta | fora da Fase 4 | backlog |

## Regra de substituição

Uma capacidade marcada como “preservado” não pode ser removida até que a nova superfície esteja homologada. Itens pendentes não bloqueiam o Preview técnico quando a API anterior permanece disponível, mas devem ser decididos antes do lançamento público.
