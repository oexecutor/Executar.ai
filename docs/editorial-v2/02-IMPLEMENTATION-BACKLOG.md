# Backlog de implementação — EXECUTA.AI Blog Integration V2

Epic: [#23](https://github.com/oexecutor/Executar.ai/issues/23)

## Prioridade P0 — E0 Contrato e arquitetura

### EDV2-001 — Criar módulo de domínio editorial

**Entrega**

```text
src/editorial/
  editorial-publication.ts
  editorial-errors.ts
  editorial-state-machine.ts
  editorial-service.ts
  editorial-store.ts
```

**Aceite**

- tipos correspondem ao contrato versionado;
- transições inválidas falham sem persistência parcial;
- eventos de auditoria são obrigatórios;
- nenhum dual-write em `ExecutarService` ou `DeskOsService`.

### EDV2-002 — Criar schema de validação

**Entrega**

- JSON Schema `EditorialPublication`;
- schema do briefing mínimo;
- fixtures válidas e inválidas.

**Aceite**

- título, objetivo e audiência obrigatórios;
- URLs e estados validados;
- `APPROVED` exige evidência de revisão;
- `PUBLISHED` exige commit e URL pública.

### EDV2-003 — Mapear dependências editoriais

**Entrega**

- adapter interfaces para Desk&Go, Frankwatching e AMES;
- referências por ID/versão;
- fallback determinístico sem simular IA.

**Aceite**

- dependências podem ser substituídas;
- AMES não é copiado para o runtime;
- ausência de uma skill retorna lacuna explícita.

## Prioridade P0 — E1 Intake e pacote editorial

### EDV2-010 — API de publicações

```text
POST /api/editorial/publications
GET  /api/editorial/publications
GET  /api/editorial/publications/:id
POST /api/editorial/publications/:id/validate
```

**Aceite**

- cria publicação em `DRAFT`;
- valida e avança para `READY_FOR_PREVIEW`;
- recupera estado após nova instância do serviço;
- não expõe segredos.

### EDV2-011 — Interface de intake

**Entrega**

- tela editorial independente do Portfólio 3–9–36;
- campos mínimos e visualização do status;
- checklist de lacunas.

**Aceite**

- funciona em mobile;
- sem rolagem horizontal;
- não publica automaticamente;
- permite salvar rascunho.

### EDV2-012 — Empacotador de artigo

**Entrega**

```text
content/blog/<slug>.md|json
content/blog/<slug>.meta.json
```

**Aceite**

- pacote reproduzível;
- frontmatter/metadados válidos;
- slug sem colisão;
- preview local do artigo.

## Prioridade P0 — E2 GitHub e Vercel Preview

### EDV2-020 — Criar branch e PR

**Aceite**

- branch `editorial/<publicationId>-<slug>`;
- commit contém apenas pacote editorial necessário;
- PR referencia a publicação e checklist;
- operação requer confirmação explícita.

### EDV2-021 — Registrar Vercel Preview

**Aceite**

- identificar deployment do commit/PR;
- salvar deployment ID e URL imutável;
- validar `/blog/:slug` por Playwright;
- registrar falha como `PREVIEW_FAILED`.

### EDV2-022 — Painel de revisão

**Aceite**

- mostrar briefing, checklist, diff, PR e preview;
- botões `Solicitar alterações` e `Aprovar`;
- nenhuma ação de merge no primeiro clique sem confirmação.

## Prioridade P0 — E3 Aprovação e publicação

### EDV2-030 — Aprovação auditável

**Aceite**

- decisão inclui revisor, timestamp e nota;
- somente `APPROVED` libera publicação;
- repetição idempotente.

### EDV2-031 — Merge e registro de produção

**Aceite**

- merge autorizado por publicação;
- captura SHA final;
- valida URL pública;
- atualiza estado para `PUBLISHED`;
- registra rollback disponível.

## Prioridade P1 — E4 QR Router

### EDV2-040 — Contrato de token semântico

```text
/q/:token
```

Token resolve:

- publicação;
- intenção `CREATE | PREVIEW | APPROVE | ANALYTICS`;
- destino atual;
- validade e política de acesso.

**Aceite**

- token não contém segredo;
- destino pode mudar sem reimpressão;
- preview ausente possui fallback seguro;
- redirecionamento é auditável.

### EDV2-041 — Gerar QR-01 a QR-04

**Aceite**

- quatro QRs distintos e rotulados;
- correção de erro adequada;
- leitura validada em celular real;
- teste automatizado de resolução.

## Prioridade P1 — E5 Impressão

### EDV2-050 — Painel A4 editorial

**Aceite**

- safe margin mínima de 5 mm;
- áreas de dobra preservadas;
- QRs fora das linhas de dobra e clipe;
- impressão a 100%, retrato e sem ajuste;
- versão P-1 declarada, sem alegar PDF/X/CMYK.

### EDV2-051 — Exportação e preflight

**Aceite**

- HTML imprimível e PDF P-1;
- verificação de contraste, overflow e QR;
- dados estruturados paralelos ao visual.

## Prioridade P2 — E6 Analytics

### EDV2-060 — Métricas por publicação

**Aceite**

- visualizações, origem, QR e conversões quando disponíveis;
- ausência de provider não bloqueia publicação;
- privacidade e retenção documentadas.

### EDV2-061 — Histórico operacional

**Aceite**

- timeline de eventos;
- versões, PRs, deployments e decisões;
- filtro por estado e autor.

## Sequência recomendada

```text
Sprint editorial 01: EDV2-001 → 002 → 003
Sprint editorial 02: EDV2-010 → 011 → 012
Sprint editorial 03: EDV2-020 → 021 → 022
Sprint editorial 04: EDV2-030 → 031
Sprint editorial 05: EDV2-040 → 041
Sprint editorial 06: EDV2-050 → 051
Sprint editorial 07: EDV2-060 → 061
```

## Gate imediato

A próxima implementação deve começar por **EDV2-001**, acompanhada de testes unitários da máquina de estados. Não iniciar QR, impressão ou analytics antes de o objeto editorial persistir e recuperar corretamente.
