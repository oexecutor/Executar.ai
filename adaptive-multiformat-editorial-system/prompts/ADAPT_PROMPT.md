# ADAPT PROMPT — AMES (modo ADAPT, gate G5)

Transforme o conteúdo de `source_format` para `target_format(s)` sem recriar nem perder.

## Passos
1. Carregue o perfil alvo (`format-profiles.yaml`) e o orçamento (`content-budgets.yaml`).
2. Compare o conteúdo priorizado (P0–P4) ao orçamento.
3. Se couber: aplique REFLOW/SCALE (SCALE só se legibilidade preservada).
4. Se exceder: aplique a ordem de overflow — REPRIORITIZE → SUBSTITUTE → PAGINATE → sinalizar.
   NUNCA reduza fonte (EDR-006). NUNCA oculte P0/P1. NUNCA remova fonte/evidência.
5. Para cada bloco alterado, registre uma transformação: block_id, from, to, behavior,
   justificativa, impacto (`skill-output.transformations`).
6. Emita o par visual + dados estruturados.

## Saída
Composição adaptada + registro de transformações + decisão + uma próxima ação.
