# Adaptação — Business Model Canvas

## A4 / desktop (bidimensional)
- 9 blocos na grade espacial (proximidade comunica relações). Comportamento: **REFLOW** dentro da grade.
- SCALE **proibido** (miniatura ilegível — `forbidden_transformations`).

## Mobile (ACC-005)
- **SUBSTITUTE**: canvas bidimensional → lista navegável por bloco (accordion/abas), ordem P0→P1.
- Alternativa **linear** obrigatória para tecnologias assistivas.

## Registro de transformações
| block_id | from | to | behavior | justificativa |
|---|---|---|---|---|
| CB-* | business-model-canvas | mobile | SUBSTITUTE | estrutura 2D não reflui em 320px; alternativa linear (ACC-005) |
