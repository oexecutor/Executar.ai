# 08 — Operação Pós-Lançamento

## Monitoramento

- **Estado atual**: 🔲 não confirmado nesta auditoria — nenhuma evidência de
  ferramenta de monitoramento/observabilidade configurada foi encontrada no
  código ou na documentação lida. A definir antes do G9.

## Erros

- Fonte primária: runtime logs do painel Vercel (não acessível nesta
  sessão). Recomendado configurar alerta para taxa de erro 5xx acima de um
  limiar antes do G9.

## Disponibilidade

- `/health` é a rota pública de referência (`api/health.ts`, sem
  autenticação). Recomendado um monitor externo de uptime batendo nela em
  intervalo regular a partir do G9.

## Suporte

- **Estado atual**: nenhum canal de suporte formal identificado. Operação
  solo-founder — plano de suporte a ser definido em `EXA-G7-REL-002` antes
  do G7 fechar.

## Incidentes

- Ver `07-PLANO-DE-ROLLBACK.md` para o procedimento técnico. Triagem inicial
  cabe ao dono do produto até que exista equipe.

## Feedback

- Nenhum mecanismo de coleta de feedback estruturado identificado no
  código. A definir junto com o desenho do beta fechado (G6).

## Triagem

- Sem equipe formal — toda triagem passa pelo dono do produto na fase
  inicial pós-lançamento.

## Cadência de releases

- A definir após o primeiro ciclo pós-lançamento; recomendado manter o
  ritmo de ondas de ~72h já usado neste roadmap para correções pequenas, e
  ciclos maiores para features novas.

## Métricas de ativação

- **LACUNA** — nenhuma métrica de ativação instrumentada hoje (sem
  analytics identificado no código). Definir junto de `EXA-G7-REL-002`/
  analytics em `05-CHECKLIST-LANCAMENTO.md`.

## Métricas de retenção

- **LACUNA** — mesma situação da ativação. Sem instrumentação hoje.

## Revisão após 24 horas

- Checklist: `/health` respondendo; nenhum erro 5xx novo; nenhum relato de
  vazamento entre workspaces (RISK-001); confirmar que o volume de uso está
  dentro do esperado para um lançamento fechado/beta.

## Revisão após 7 dias

- Checklist: revisar logs de erro acumulados; revisar decisões pendentes que
  possam ter se tornado urgentes (ex.: se `DECISÃO NECESSÁRIA #1` ainda
  estiver aberta e houver mais de um usuário real, isso vira P0 imediato);
  primeira leitura de métricas de ativação, se instrumentadas.

## Revisão após 30 dias

- Checklist: revisão completa do roadmap G0–G10 — o que mudou, o que foi
  aprendido, replanejamento do próximo ciclo de 72h/ondas; revisão de
  métricas de retenção; decisão sobre cadência de releases definitiva.
