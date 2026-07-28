# EXECUTA.AI — pacote seguro de ambiente

Esta pasta contém o contrato final das variáveis da automação editorial E2.
Ela não contém credenciais reais, porque tokens GitHub/Vercel não podem ser
extraídos dos conectores do ChatGPT nem armazenados no Git.

## Arquivos

- `editorial-e2.production.env.example`: valores finais de produção e campos
  reservados para os dois tokens privados.
- `editorial-e2.preview.env.example`: mesmo contrato para Previews.
- `VERCEL-SETUP.md`: configuração direta na Vercel, sem enviar segredos pelo
  chat.
- `verify-editorial-e2.mjs`: verificação local sem imprimir os tokens.

## Regra de segurança

Os arquivos `*.env`, `*.local`, `*.secret` e o diretório `tokens/` desta
pasta são ignorados pelo Git. Nunca renomeie um arquivo com credenciais para
`*.example`.

## Próxima ação

Crie os dois tokens nos respectivos provedores e registre-os diretamente nas
variáveis do projeto `executar-ai` na Vercel. Depois faça um novo deploy de
produção e execute:

```bash
npm run env:check -- --editorial-e2
```

Com a E2 ativa, retome no painel Editorial a publicação
`PUB-20260728-b4fbb3cc`.
