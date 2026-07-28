# 08 — Operação Pós-Lançamento

> Atualizado em 2026-07-28 para operação solo-founder real, substituindo as
> LACUNAs do baseline de 24/07 por um processo executável. Sem equipe
> formal: todo item abaixo assume o dono do produto como responsável único,
> a menos que marcado como delegável a execução assistida (Claude Code).

## Monitoramento

- **Estado**: `/health` (`api/health.ts`) é a rota de referência — pública,
  sem autenticação, reporta `status`, `transport`, `authentication` e
  presença (nunca valores) de configuração `supabase`/`postgres`.
- **Ação mínima antes de G9**: configurar um monitor externo de uptime
  gratuito (ex.: UptimeRobot, Better Uptime) batendo em `/health` a cada
  5 minutos, com alerta por e-mail/push para o dono do produto. Isso não
  depende de nenhuma decisão de produto — é puramente operacional e pode
  ser feito em minutos.
- **Runtime logs**: painel Vercel → projeto `executar-ai` → Logs. Revisar
  manualmente após cada deploy (ver "Revisão após 24 horas" abaixo).

## Erros

- Fonte primária: runtime logs do painel Vercel.
- **Regra de triagem**: erro 5xx sustentado (mais de 1% das requisições em
  uma janela de 15 min, ou qualquer erro 5xx em `/api/auth/*` ou `/mcp`)
  é P0 — acionar `07-PLANO-DE-ROLLBACK.md` imediatamente, não esperar
  investigação completa primeiro.
- Erro pontual/isolado sem padrão: registrar e revisar na próxima janela
  diária, não é incidente.

## Disponibilidade

- `/health` é a rota pública de referência. Ver "Monitoramento" acima.

## Suporte

- **Canal único, por enquanto**: e-mail. Definir o endereço em
  `web/public/terms.html`/`privacy.html` (hoje com placeholder
  `[e-mail de suporte a definir]`) antes de anunciar o lançamento —
  sem isso, usuários não têm como reportar problema.
- **SLA informal, realista para operação solo-founder**: resposta em até
  48h em dias úteis para dúvidas; resposta em até 4h para relatos de
  possível vazamento de dados entre workspaces (dado o histórico do
  RISK-001) ou indisponibilidade total do Serviço.
- **Triagem**: todo contato de suporte vira uma entrada em
  `04-RISCOS-DECISOES.md` se revelar um risco novo, ou uma issue no
  backlog (`02-BACKLOG-LINEAR.csv`) se for um bug — não fica só em e-mail
  perdido.

## Incidentes

- Processo: ver "Como identificar um incidente" e "Rollback específico de
  autenticação" em `07-PLANO-DE-ROLLBACK.md` — cobre os dois cenários mais
  prováveis pós-lançamento (auth quebrada por config ausente; erro 5xx
  sustentado).
- **Comunicação durante incidente**: se afetar mais de um usuário do beta,
  enviar um aviso direto por e-mail para os workspaces ativos assim que o
  incidente for confirmado (não esperar a correção) e um follow-up quando
  resolvido, com uma frase sobre a causa.
- **Registro pós-incidente**: todo incidente P0 vira uma linha nova em
  `04-RISCOS-DECISOES.md` — o que aconteceu, o que foi feito, o que muda
  para não repetir.

## Feedback

- **Mecanismo mínimo**: o mesmo e-mail de suporte, mais uma pergunta direta
  a cada convidado do beta fechado após a primeira semana de uso (já
  desenhada em `14-PLANO-GTM.md` §E: "o que você fez essa semana que não
  teria feito, ou teria feito pior, sem isso?").
- Não construir formulário de feedback dedicado antes do G6 — é
  sobre-engenharia para o volume esperado de usuários nesta fase.

## Triagem

- Sem equipe formal — toda triagem passa pelo dono do produto. Execução
  assistida (Claude Code) pode diagnosticar e propor correção quando
  acionada, mas não decide sozinha sobre comunicação a usuários ou
  mudanças de política (auth, dados, preço).

## Cadência de releases

- Manter o ritmo de ondas de ~72h já usado no roadmap para correções
  pequenas. Mudanças que tocam autenticação, persistência ou billing
  sempre passam por verificação local completa (`npm run build`,
  `npm test`, `npm run lint`, `npx playwright test`) antes de qualquer
  push a `main` — sem exceção, independente de prazo.

## Métricas de ativação

- Definidas em `14-PLANO-GTM.md` §E: primeiro projeto criado + primeiro
  checkpoint concluído. **Ainda não instrumentado** — é o item
  `EXA-G6-GTM-002` do backlog, a fazer antes de convidar o beta fechado,
  não antes (medir cedo demais só captura o próprio uso do fundador).

## Métricas de retenção

- Definida em `14-PLANO-GTM.md` §E: retorno em semana diferente da
  primeira. Mesma dependência de `EXA-G6-GTM-002`.

## Revisão após 24 horas

- Checklist: `/health` respondendo; nenhum erro 5xx novo nos logs Vercel;
  nenhum relato de vazamento entre workspaces; login funcionando de ponta
  a ponta (criar conta → escolher workspace → ver projetos) testado
  manualmente pelo próprio dono do produto, não só por evidência de código.

## Revisão após 7 dias

- Checklist: revisar logs de erro acumulados; confirmar que
  `ALLOW_PUBLIC_WORKSPACE_FALLBACK` não ficou ligado sem necessidade;
  primeira leitura de métricas de ativação, se instrumentadas; revisar se
  algum contato de suporte revelou risco novo.

## Revisão após 30 dias

- Checklist: revisão completa do roadmap G0–G10 — o que mudou, o que foi
  aprendido; revisão de métricas de retenção; decisão sobre `EXA-G7-GTM-001`
  (confirmar ou revisar o caminho de modelo de negócio híbrido) com base
  em uso real, não em hipótese.
