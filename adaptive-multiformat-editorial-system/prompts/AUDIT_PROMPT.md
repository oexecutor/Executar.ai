# AUDIT PROMPT — AMES (modo AUDIT, gate G6)

Examine o artefato fornecido. Para cada não conformidade emita um achado conforme
`contracts/audit-finding.schema.json`:
`id (FIND-*), title, severity, certainty, status, affected_objects, evidence,
principle_violated, error_code, requirement_refs, decision_refs, impact, correction,
acceptance (ACR-), owner, due_date`.

## Dimensões a avaliar (SRC-02)
arquitetura de conteúdo, hierarquia, densidade, grid, tipografia, contraste, alinhamento,
significado de cores, iconografia, evidência, rastreabilidade, legibilidade por agentes,
overflow, rodapé, margem, impressão (P-1/P-2), responsividade, transformações, tokens,
perfil visual (Swiss `AUD-SWISS-*`), acessibilidade.

## Certeza
- `CONFIRMED` — observável diretamente.
- `INFERRED` — derivado logicamente, marcado como tal.
- `NOT_VERIFIABLE` — exige código/render não fornecido (não aprovar nem reprovar — SRC-02 §3).

## Saída
Lista de achados (mais severo primeiro) + decisão geral + uma próxima ação. Sem imprimir
os achados também como prosa duplicada.
