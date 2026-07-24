---
document_id: SPEC-EDITORIAL-AMES-001
version: "1.0"
status: PROPOSED
canonical_for: [pipeline, comportamentos, prioridade, densidade, gramática de gráficos]
source: SRC-01, SRC-02
---
# Editorial Spec — AMES

Fonte canônica dos princípios editoriais. Regras operacionais vivem nos contratos; aqui
está a **narrativa e a intenção**, com referências por ID.

## 1. Pipeline (obrigatório)
`conteúdo estruturado → modelo semântico → evidência → prioridade editorial → perfil de
formato → comportamento de transformação → variante de componente → composição →
validação → saída`. Mudar de formato **não** altera o dado; altera quantidade exibida,
ordem, densidade, colunas, variante, representação, paginação e nível de detalhe.

## 2. Cinco comportamentos
Definições e guardas: `contracts/transformation-rules.yaml`. Decisão: `ADR-004`.
SCALE só com legibilidade preservada; overflow nunca resolvido por redução de fonte (`EDR-006`).

## 3. Prioridade editorial P0–P4
- `P0` obrigatório/legal/bloqueador · `P1` conclusão/decisão/mensagem principal ·
  `P2` evidência/contexto · `P3` complemento · `P4` metodologia/histórico/apêndice.
- P0/P1 permanecem visíveis; P2 resumível; P3 → detalhe/expansão/página secundária;
  P4 → apêndice/QR/modal/doc técnica. Decisão: `EDR-002`.

## 4. Uma conclusão dominante por superfície
`EDR-001`. Cada superfície tem um objetivo e uma ação principais. Catálogo, auditoria,
decisão e governança são separados/paginados.

## 5. Modos de densidade
`spacious` (execução), `comfortable` (análise), `compact` (apêndice técnico), `data-dense`
(dashboards). Proporção mínima de branco por densidade em `content-budgets.yaml`.

## 6. Gramática narrativa de gráficos
`EDR-004`: título declara a conclusão; source+period obrigatórios; rótulos diretos; ≤5
séries, ≤2 casas decimais, 1 cor de destaque; fallback textual + alternativa em tabela.

## 7. Gauges
`EDR-005`: apenas meta/capacidade/valor limitado; nunca comparação de categorias.

## 8. Governança epistemológica
FACT/EVIDENCE/INFERENCE/HYPOTHESIS/COUNTEREVIDENCE/GAP/RECOMMENDATION em `evidence-governance.yaml`.
