---
document_id: SRS-AMES-001
version: "1.0"
status: PROPOSED
source_contract: GOV-AMES-001
note: >
  Requisitos numerados e imutáveis. Cada um contém id, title, statement, rationale,
  priority, source, acceptance, test_refs, decision_refs. Requisitos P0/P1 possuem
  testes associados. Linguagem normativa MUST/SHOULD/MAY/MUST NOT.
---

# SRS — Adaptive Multi-format Editorial System

## Funcionais (FR)

### FR-001 — Fonte única de conteúdo
- **statement**: O sistema **MUST** preservar uma única fonte de conteúdo, arquitetura semântica, tokens e componentes entre todos os formatos.
- **rationale**: BR-001; evita divergência entre formatos.
- **priority**: P0 · **source**: SRC-01, SRC-05 §1
- **acceptance**: ACR-011 · **test_refs**: [TEST-SCHEMA-01] · **decision_refs**: [ADR-001, ADR-002]

### FR-002 — Comportamento de adaptação declarado
- **statement**: Toda adaptação **MUST** declarar ≥1 comportamento (SCALE/REFLOW/REPRIORITIZE/SUBSTITUTE/PAGINATE) com justificativa e impacto.
- **rationale**: EDS-003; adaptação explícita e testável.
- **priority**: P0 · **source**: SRC-01
- **acceptance**: ACR-013 · **test_refs**: [TEST-TR-01, TEST-TR-03] · **decision_refs**: [ADR-004]

### FR-003 — Uma decisão e uma próxima ação
- **statement**: A saída de cada gate **MUST** conter exatamente uma `decision` e uma `next_action`.
- **rationale**: controle single-gate; EDS-035.
- **priority**: P0 · **source**: SRC-05 §12, §27
- **acceptance**: ACR-020 · **test_refs**: [TEST-OUT-01] · **decision_refs**: [ADR-008]

### FR-004 — Não auto-avançar
- **statement**: O sistema **MUST NOT** avançar automaticamente para o próximo gate.
- **rationale**: single-gate; aprovação humana.
- **priority**: P0 · **source**: SRC-05 §6
- **acceptance**: ACR-020 · **test_refs**: [TEST-OUT-01] · **decision_refs**: [ADR-008]

### FR-005 — Par visual + estruturado
- **statement**: O sistema **MUST** emitir saída visual acompanhada de dados estruturados paralelos.
- **rationale**: EDS-031; leitura por agente.
- **priority**: P0 · **source**: SRC-01, SRC-02
- **acceptance**: ACR-010 · **test_refs**: [TEST-AI-01] · **decision_refs**: [ADR-007]

### FR-006 — Auditoria acionável
- **statement**: O modo AUDIT **MUST** produzir achados tipados (severidade, certeza, evidência, correção, critério) ligados a requisito/decisão.
- **rationale**: JTBD-003; EDS-033/036.
- **priority**: P1 · **source**: SRC-05 §21
- **acceptance**: ACR-007 · **test_refs**: [TEST-AUDIT-01] · **decision_refs**: []

### FR-007 — Resolver overflow sem encolher fonte
- **statement**: Overflow **MUST** ser resolvido por REPRIORITIZE/SUBSTITUTE/PAGINATE; **MUST NOT** por redução de fonte.
- **rationale**: EDS-007/041; EDR-006.
- **priority**: P0 · **source**: SRC-01
- **acceptance**: ACR-017 · **test_refs**: [TEST-TR-02] · **decision_refs**: [EDR-006, ADR-004]

## Dados (DR)

### DR-001 — Prioridade obrigatória
- **statement**: Todo bloco **MUST** possuir `priority` P0–P4.
- **priority**: P0 · **source**: SRC-01 · **acceptance**: ACR-003 · **test_refs**: [TEST-CONTENT-01] · **decision_refs**: [EDR-002]

### DR-002 — Representação + fallback
- **statement**: Todo bloco **MUST** ter ≥1 representação e `text_fallback`.
- **priority**: P0 · **source**: SRC-01 · **acceptance**: ACR-013 · **test_refs**: [TEST-CONTENT-02] · **decision_refs**: [ADR-007]

### DR-003 — IDs únicos
- **statement**: Todo bloco/achado/requisito **MUST** ter ID estável e único.
- **priority**: P0 · **source**: SRC-02 EDS-033 · **acceptance**: ACR-011 · **test_refs**: [TEST-SCHEMA-03] · **decision_refs**: []

### DR-004 — Relações normalizadas
- **statement**: Relações entre objetos **MUST** usar o enum de `GLOSSARY` (não prosa).
- **priority**: P1 · **source**: SRC-02 EDS-025 · **acceptance**: ACR-006 · **test_refs**: [TEST-CONTENT-04] · **decision_refs**: [ADR-003]

### DR-005 — Proveniência
- **statement**: Toda evidência/metric/chart/table **MUST** registrar source e data (version/checksum quando houver).
- **priority**: P1 · **source**: SRC-02 EDS-028 · **acceptance**: ACR-016 · **test_refs**: [TEST-EV-01] · **decision_refs**: []

## Não-funcionais (NFR)

### NFR-001 — Legível por agente sem OCR
- **statement**: A saída **MUST** ser legível por agentes sem OCR nem reconstrução visual.
- **priority**: P0 · **source**: SRC-02 EDS-031 · **acceptance**: ACR-010 · **test_refs**: [TEST-AI-01] · **decision_refs**: [ADR-001, ADR-007]

### NFR-002 — Sem duplicação de regra
- **statement**: Nenhuma regra **MUST** ser duplicada; documentos secundários referenciam por ID.
- **priority**: P1 · **source**: SRC-05 §25 · **acceptance**: ACR-011 · **test_refs**: [TEST-TRACE-01] · **decision_refs**: [ADR-009]

### NFR-003 — Determinismo de ranking/seleção
- **statement**: Ordenações/rankings **MUST** ser reproduzíveis por score e evidência.
- **priority**: P1 · **source**: SRC-02 EDS-019 · **acceptance**: ACR-005 · **test_refs**: [TEST-AI-04] · **decision_refs**: []

### NFR-004 — Tokens não hard-coded
- **statement**: Nenhum valor visual importante **MUST** ficar hard-coded em componente.
- **priority**: P1 · **source**: SRC-01, SRC-05 §17 · **acceptance**: ACR-011 · **test_refs**: [TEST-TOKEN-01] · **decision_refs**: [ADR-002]

## Acessibilidade (ACC)

### ACC-001 — Contraste
- **statement**: Texto informacional **MUST** atingir contraste adequado e permanecer legível em escala de cinza.
- **priority**: P0 · **source**: SRC-02 EDS-008 · **acceptance**: ACR-008 · **test_refs**: [TEST-A11Y-01] · **decision_refs**: []

### ACC-002 — Não depender só de cor
- **statement**: Significado **MUST NOT** depender exclusivamente de cor; usar rótulo + ícone + forma.
- **priority**: P0 · **source**: SRC-02 EDS-037 · **acceptance**: ACR-004, ACR-009 · **test_refs**: [TEST-A11Y-05] · **decision_refs**: []

### ACC-003 — Reflow 320px
- **statement**: A saída digital **MUST** refluir sem perda em 320 CSS px.
- **priority**: P1 · **source**: SRC-02 EDS-040 · **acceptance**: ACR-015 · **test_refs**: [TEST-A11Y-03] · **decision_refs**: []

### ACC-004 — Zoom 200%
- **statement**: A saída digital **SHOULD** permanecer utilizável em zoom de 200%.
- **priority**: P2 · **source**: SRC-02 · **acceptance**: ACR-015 · **test_refs**: [TEST-A11Y-04] · **decision_refs**: []

### ACC-005 — Alternativa linear do BMC
- **statement**: O Business Model Canvas **MUST** possuir alternativa linear para mobile e tecnologias assistivas.
- **priority**: P1 · **source**: SRC-01 · **acceptance**: ACR-013 · **test_refs**: [TEST-A11Y-07] · **decision_refs**: []

### ACC-006 — Ícones com rótulo
- **statement**: Ícones **MUST** ter rótulo textual/nome acessível.
- **priority**: P1 · **source**: SRC-02 EDS-038 · **acceptance**: ACR-009 · **test_refs**: [TEST-A11Y-06] · **decision_refs**: []

### ACC-007 — Tabelas semânticas
- **statement**: Tabelas **MUST** usar marcação semântica (th/scope) e ter alternativa textual.
- **priority**: P1 · **source**: SRC-02 · **acceptance**: ACR-006 · **test_refs**: [TEST-A11Y-08] · **decision_refs**: []

### ACC-008 — Reduced motion
- **statement**: Movimento **MUST** respeitar `prefers-reduced-motion`.
- **priority**: P2 · **source**: SRC-01 · **acceptance**: ACR-015 · **test_refs**: [TEST-A11Y-09] · **decision_refs**: []

## Impressão (PRINT)

### PRINT-001 — Separar P-1/P-2
- **statement**: O sistema **MUST** separar formalmente impressão P-1 (escritório) de P-2 (profissional).
- **priority**: P0 · **source**: SRC-01, SRC-05 §20 · **acceptance**: ACR-019 · **test_refs**: [TEST-PRINT-06] · **decision_refs**: [ADR-006]

### PRINT-002 — Escala 100%
- **statement**: Impressão **MUST** ocorrer a 100%, legível sem zoom nem redução de escala.
- **priority**: P0 · **source**: SRC-02 EDS-007 · **acceptance**: ACR-001 · **test_refs**: [TEST-PRINT-01] · **decision_refs**: [EDR-006]

### PRINT-003 — Safe-area e rodapé
- **statement**: Conteúdo **MUST** respeitar safe-area e rodapé reservado; nada na área de corte.
- **priority**: P0 · **source**: SRC-02 EDS-014/043 · **acceptance**: ACR-002 · **test_refs**: [TEST-PRINT-03] · **decision_refs**: []

### PRINT-004 — Break-inside
- **statement**: Componentes indivisíveis **MUST** usar `break-inside: avoid`.
- **priority**: P1 · **source**: SRC-01 · **acceptance**: ACR-002 · **test_refs**: [TEST-PRINT-04] · **decision_refs**: []

### PRINT-005 — Requisitos P-2
- **statement**: P-2 **MUST** exigir PDF/X, CMYK, ICC, sangria, fontes incorporadas, 300 dpi e preflight.
- **priority**: P1 · **source**: SRC-05 §20 · **acceptance**: ACR-019 · **test_refs**: [TEST-PRINT-06] · **decision_refs**: [ADR-006]

### PRINT-006 — Não prometer gráfica em P-1
- **statement**: O sistema **MUST NOT** declarar exportação de navegador (P-1) como arquivo profissional pronto para gráfica.
- **priority**: P0 · **source**: SRC-01, SRC-02 EDS-042 · **acceptance**: ACR-014, ACR-019 · **test_refs**: [TEST-PRINT-05] · **decision_refs**: [ADR-006]

## Segurança/Governança (SEC)

### SEC-001 — Sem ação externa sem aprovação
- **statement**: O sistema **MUST NOT** escrever/publicar externamente sem aprovação.
- **priority**: P0 · **source**: SRC-05 §25 · **acceptance**: ACR-020 · **test_refs**: [TEST-GOV-01] · **decision_refs**: []

### SEC-002 — Não substituir/apagar fonte
- **statement**: O sistema **MUST NOT** substituir arquivos nem apagar conteúdo de origem sem autorização.
- **priority**: P0 · **source**: SRC-05 §25 · **acceptance**: ACR-020 · **test_refs**: [TEST-GOV-02] · **decision_refs**: []

### SEC-003 — Valores herdados PROVISIONAL
- **statement**: Valores herdados de outro pacote **MUST** permanecer `PROVISIONAL` até validação na origem.
- **priority**: P1 · **source**: SRC-04 CONTRACT-MASTER §5 · **acceptance**: ACR-016 · **test_refs**: [TEST-EV-01] · **decision_refs**: [ADR-002]

## Agente (AI)

### AI-001 — Saída estruturada paralela
- **statement**: Todo artefato visual **MUST** ter par de dados estruturados.
- **priority**: P0 · **source**: SRC-02 EDS-031 · **acceptance**: ACR-010 · **test_refs**: [TEST-AI-01] · **decision_refs**: [ADR-007]

### AI-002 — Relações explícitas
- **statement**: Relações **MUST** ser explícitas (campos), não implícitas em prosa.
- **priority**: P1 · **source**: SRC-02 EDS-034 · **acceptance**: ACR-006 · **test_refs**: [TEST-CONTENT-04] · **decision_refs**: []

### AI-003 — Achados referenciáveis
- **statement**: Achados **MUST** ter ID global para referência/atualização/encerramento.
- **priority**: P1 · **source**: SRC-02 EDS-033 · **acceptance**: ACR-007 · **test_refs**: [TEST-AUDIT-01] · **decision_refs**: []

## Swiss (SWISS)

### SWISS-001 — Grid modular + baseline
- **statement**: O perfil Swiss **MUST** usar grid modular e baseline grid.
- **priority**: P1 · **source**: SRC-03 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-01] · **decision_refs**: [EDR-003]

### SWISS-002 — Alinhamento à esquerda / borda irregular
- **statement**: O perfil Swiss **MUST** alinhar à esquerda com borda direita irregular no corpo.
- **priority**: P1 · **source**: SRC-03 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-02] · **decision_refs**: [EDR-003]

### SWISS-003 — ≤3 pesos, ≤4 níveis
- **statement**: O perfil Swiss **MUST NOT** exceder três pesos tipográficos nem quatro níveis de hierarquia simultâneos.
- **priority**: P1 · **source**: SRC-03, SRC-02 EDS-011 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-03] · **decision_refs**: [EDR-003]

### SWISS-004 — Preto e branco
- **statement**: A composição Swiss **MUST** permanecer clara em preto e branco.
- **priority**: P0 · **source**: SRC-03 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-06] · **decision_refs**: [EDR-003]

### SWISS-005 — Proibições decorativas
- **statement**: O perfil Swiss **MUST NOT** usar pills, emojis, sombras, gradientes ou glassmorphism.
- **priority**: P1 · **source**: SRC-03, SRC-02 EDS-045 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-04] · **decision_refs**: [EDR-003]

### SWISS-006 — Cor econômica semântica
- **statement**: Cada cor **MUST** ter um único papel semântico; accent ≤5% da área (ref `TOK-DESKGO-SWISS-001`).
- **priority**: P1 · **source**: SRC-03, SRC-02 EDS-047 · **acceptance**: ACR-008 · **test_refs**: [TEST-SWISS-05] · **decision_refs**: [EDR-003, ADR-002]
