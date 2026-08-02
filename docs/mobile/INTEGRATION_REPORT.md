# Relatório de integração — 2 de agosto de 2026

## Descoberta

O projeto Vercel `executar-ai` está conectado a `oexecutor/P1.Executar.ai`. O repositório canônico não é Next.js/Next Forge: ele contém funções TypeScript na Vercel e frontend React/Vite.

## Decisão

- preservar o backend MCP, OAuth, blog, vault e frontend Vite;
- adicionar `api/mobile.ts` ao mesmo deploy;
- adicionar Expo como aplicação independente em `apps/mobile`;
- manter os pacotes universais em `packages/*`;
- não adicionar Turbo ao repositório raiz;
- não alterar o lockfile raiz;
- reutilizar o projeto Supabase já ativo;
- manter confirmação humana obrigatória para QR.

## Resultado esperado do PR

- Vercel cria preview automaticamente usando a configuração atual;
- GitHub Actions executa o build real do Expo;
- o erro anterior de registry para `turbo` deixa de ser relevante;
- produção não é promovida até os dois checks ficarem verdes.
