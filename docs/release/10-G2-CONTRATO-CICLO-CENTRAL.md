# 10 — G2: Contrato do Ciclo Central

> Estado: **EM EXECUÇÃO** · Data: 2026-07-25 · Gate anterior: G1 aprovado.

## 1. Decisão executiva

O ciclo central do aplicativo seguirá **uma única fonte de verdade**:

- `ProjectDoc` (`src/executar/types.ts`) é o contrato canônico do plano
  **3 fases × 9 áreas × 36 itens**;
- `ExecutarService` (`src/executar/service.ts`) é o serviço canônico para criar,
  validar, avançar, exportar, persistir e recuperar esse plano;
- `/api/executar/*` é a API canônica usada pelo frontend;
- a skill/plano guiado por LLM atua **antes da persistência**, produzindo uma
  proposta JSON compatível com `ProjectDoc`;
- `DeskOsService` não fará dual-write no ciclo 3–9–36 durante o G2.

Essa decisão evita duas bases operacionais concorrentes e preserva a regra de
`AGENTS.md`: não criar uma segunda fonte independente de verdade.

## 2. Fluxo aprovado para PLANGEN / IA

O `plano-operacional-rastreavel` não será transformado agora em um endpoint
LLM síncrono dentro do backend. Ele será conectado como **gerador assistido de
proposta**, com validação e aprovação humana explícitas.

```text
CONTEXTO DO USUÁRIO
→ SKILL / LLM ESTRUTURA CANDIDATO ProjectDoc
→ POST /api/executar/validate
→ REVISÃO HUMANA
→ POST /api/executar/projects { project }
→ EXECUÇÃO DE AÇÕES E CHECKPOINTS
→ EXPORTAÇÃO / PERSISTÊNCIA / RECUPERAÇÃO
```

### Contrato de entrada da IA

A saída deve conter:

- `meta.id` no formato `PRJ-*`;
- exatamente 3 fases (`F1`, `F2`, `F3`);
- exatamente 9 áreas (`A01`–`A09`);
- 4 itens por área: 1 checkpoint + 3 tarefas;
- até 3 ações por tarefa;
- condição de parada verificável por ação;
- evidência esperada por tarefa/checkpoint;
- ao menos 1 entregável final ligado às áreas.

A validação determinística está em `src/executar/schema.ts`. Conteúdo gerado por
LLM que não passe nesse contrato não pode ser persistido.

### Fallback sem IA

Quando nenhum `ProjectDoc` é fornecido, `buildCanonicalProject` gera uma
estrutura determinística. Esse caminho é um fallback funcional, não deve ser
apresentado como geração por IA.

## 3. Comparação: contrato 3–9–36 × DeskOsService

| Capacidade | `ExecutarService` / `ProjectDoc` | `DeskOsService` | Decisão G2 |
|---|---|---|---|
| 3 fases, 9 áreas, 36 itens | Nativo e validado | Não é a hierarquia central | `ProjectDoc` canônico |
| 81 ações atômicas | Nativo | Tarefas com até 3 passos | Manter no EXECUTAR |
| Checkpoints por área | Nativo, com gate de predecessores | Transições e propostas | Manter no EXECUTAR |
| Próxima ação | `getNext` determinístico | `getToday` por sprint/status | UI atual usa EXECUTAR |
| Exportação | Projeto + progresso JSON | Entidades separadas no Vault | Pacote EXECUTAR é o handoff canônico |
| Propostas e aprovação | Importação + validação + submit | Proposta VALIDATED/APPLIED com backup | Absorver o padrão de aprovação depois, sem dual-write |
| Evidência | Requisito textual + booleano de progresso | Entidade de evidência auditável | Lacuna do EXECUTAR; evoluir após validar o ciclo básico |
| Auditoria/versionamento | Limitado | Nativo | Evolução planejada, sem trocar a fonte de verdade agora |
| Sprint/Kanban | Não faz parte do contrato 3–9–36 | Nativo | Integração posterior, não bloqueia G2 básico |

## 4. O que já está funcional

- criação determinística de projeto 3–9–36;
- importação de `ProjectDoc` gerado externamente;
- validação estrutural antes da persistência;
- 27 tarefas, 9 checkpoints e 81 ações;
- checkpoint bloqueado até concluir as tarefas predecessoras;
- cálculo de progresso e próxima ação;
- exportação do projeto com estado;
- persistência por adaptador e recuperação após recarregar;
- frontend para criar/importar, executar ações, validar checkpoints e exportar.

## 5. Evidência automatizada adicionada no G2

`tests/executar.test.ts` agora cobre o ciclo completo:

1. cria o projeto;
2. consulta a próxima ação;
3. conclui as 81 ações;
4. valida os 9 checkpoints;
5. confirma 100% de progresso;
6. confirma ausência de próxima ação;
7. exporta projeto + 90 marcas de progresso;
8. instancia uma nova sessão sobre o mesmo armazenamento;
9. recupera o projeto com o mesmo estado.

Essa prova reduz o risco de regressão do motor e da persistência. Ela não
substitui o smoke test de escrita em produção.

## 6. Lacunas reais do G2

| ID | Lacuna | Tratamento |
|---|---|---|
| G2-GAP-001 | O app não chama um modelo de IA internamente | Skill externa produz `ProjectDoc`; não criar dependência síncrona agora |
| G2-GAP-002 | A UI não mostra prévia completa do JSON antes de criar | Evolução de UX posterior ao contrato básico |
| G2-GAP-003 | Evidência é requisito textual, não anexo auditável | Absorver padrão de evidência do `DeskOsService` sem dual-write |
| G2-GAP-004 | Não há smoke de POST executável pelo conector Vercel disponível nesta sessão | Realizar pela UI ou cliente HTTP autorizado e registrar IDs/respostas |
| G2-GAP-005 | Backlog JSON ainda reflete estados do baseline de 24/07 | Não sincronizar externamente antes de `APROVADO PARA LINEAR` |

## 7. Smoke test de saída do G2

Executar em preview ou produção controlada, usando um projeto descartável sem
dados privados:

1. criar/importar um projeto;
2. registrar o ID retornado;
3. recarregar e confirmar presença no portfólio;
4. concluir `T02.1` e confirmar progresso persistido;
5. exportar e confirmar `progress["T02.1"] = true`;
6. remover o projeto de teste somente com confirmação explícita.

### Critério de aprovação

G2 poderá ser marcado **APROVADO** quando houver:

- teste automatizado verde;
- preview/deploy verde;
- escrita e recuperação confirmadas em ambiente real;
- decisão PLANGEN registrada — concluída neste documento;
- nenhum erro 500 no ciclo.

## 8. Próxima ação única

Homologar um projeto descartável pelo fluxo real da interface e registrar a
evidência de criação, reload, avanço, exportação e recuperação. Até essa
homologação, o G2 permanece **EM EXECUÇÃO**, não aprovado.
