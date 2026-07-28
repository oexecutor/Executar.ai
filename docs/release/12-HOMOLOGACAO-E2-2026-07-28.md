# Homologação E2 — autorização de merge e produção

Data do registro: **2026-07-28 UTC / 2026-07-27 BRT**
Escopo: **PR #30 — correção DEF-E2-001**
Decisão: **GO para merge e deploy automático em produção**

## Registro epistemológico

| Tipo | Registro |
|---|---|
| FATO | A PR #30 implementa a etapa E2 antes do registro GitHub e protege `preview/start` no servidor. |
| EVIDÊNCIA | A suíte local passou com 175/175 testes de back-end e 12/12 testes de interface. |
| EVIDÊNCIA | Builds, linters, contrato de ambiente e auditoria de dependências foram aprovados. |
| EVIDÊNCIA | Os projetos Vercel `executar-ai` e `executa-journal-preview` publicaram o commit `72cfe9df62950db6cbf2d34da7d8779fa436b820` como Preview `READY`. |
| EVIDÊNCIA | Os dois checks Vercel estão verdes e não foram encontrados erros `error` ou `fatal` nos logs de runtime dos Previews. |
| EVIDÊNCIA | Leonardo Batista autorizou explicitamente o merge após revisar o resultado e os dois Previews. |
| DECISÃO | A PR #30 pode sair de draft, ser mesclada em `main` e acionar o deploy automático de produção. |
| DECISÃO | A PR #29 permanece sem merge, preservada como evidência do comportamento defeituoso anterior. |
| LACUNA ACEITA | O cenário Playwright foi adicionado, mas não executou localmente por ausência do binário Chromium no ambiente de validação. |

## Critérios de saída do DEF-E2-001

| Critério | Evidência | Estado |
|---|---|---|
| Adapter não executado bloqueia gate e Preview | testes de domínio/API | APROVADO |
| Adapter falho bloqueia gate e Preview | testes de domínio/API | APROVADO |
| `APPLIED` manual sem evidência é recusado | testes de API e contrato | APROVADO |
| Alteração do conteúdo produz `STALE` | testes de domínio | APROVADO |
| H1 e H2 são bloqueadores | testes de gate | APROVADO |
| Chamada direta a `preview/start` é protegida | testes de serviço/API | APROVADO |
| Três adapters válidos liberam o gate | testes de ciclo E2 | APROVADO |
| Gate, GitHub e Preview usam o mesmo hash e versão | testes de integridade | APROVADO |
| Commit aprovado é o commit publicado no Preview | metadados Vercel/GitHub | APROVADO |

## Limite da decisão

Este `GO` aprova a correção E2 para produção. Ele não encerra automaticamente
os demais gates de lançamento público do EXECUTA.AI: o G2 continua em execução
até que seus próprios critérios sejam concluídos.

## Verificação obrigatória após o merge

1. confirmar os dois deployments de produção em estado `READY`;
2. confirmar que ambos apontam para o merge da PR #30;
3. verificar `/`, `/app/` e `/api/editorial/publications`;
4. inspecionar erros de build e runtime;
5. registrar o resultado na conversa da PR #30.

## Rollback

Se a verificação de produção falhar, restaurar o deployment anterior associado
ao commit `638b28bc62b420a58f637fae6cf424b57978956e` e reabrir o bloqueio
`DEF-E2-001`. A migration E2 é expansiva e não remove dados legados.
