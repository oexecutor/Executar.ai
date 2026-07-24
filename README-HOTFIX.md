# EXECUTA.AI — Hotfix P0

## Objetivo

Corrigir os dois bloqueios confirmados em produção:

1. as funções `api/*.ts` recebem um objeto Node da Vercel, mas o código espera
   `Request`/`Response` da Web API;
2. a landing ainda envia o administrador para `/entrar`.

## Conteúdo

- `src/lib/vercel-node-adapter.ts` — converte Node request/response para Web
  Request/Response e preserva respostas em streaming;
- `scripts/apply_vercel_hotfix.py` — adapta os handlers `api/*.ts` sem
  reescrever a lógica de negócio;
- `.github/workflows/apply-p0-hotfix.yml` — executa patch, testes e build antes
  de fazer commit em `main`.

## Aplicação pelo Claude Code

Copie esta pasta para a raiz do repositório `oexecutor/Executar.ai`, preservando
os caminhos internos, e execute:

```bash
python3 scripts/apply_vercel_hotfix.py
npm ci
npm test --if-present
npm run build --if-present
git diff
```

Depois valide o diff e publique:

```bash
git add api src scripts .github/workflows/apply-p0-hotfix.yml
git commit -m "fix(vercel): adapt runtime and open login-free workspace"
git push origin main
```

A Vercel deverá iniciar um novo deployment automaticamente.

## Prompt pronto para o Claude Code

```text
Aplique o pacote EXECUTAR-AI-P0-HOTFIX na raiz do repositório
oexecutor/Executar.ai.

Objetivo obrigatório:
1. adaptar todos os handlers api/*.ts do formato Web Request/Response para o
   runtime Node da Vercel;
2. preservar o fallback de workspace público compartilhado já existente;
3. trocar os CTAs públicos de /entrar para /app;
4. impedir que o administrador precise criar usuário, e-mail ou senha nesta
   fase;
5. executar testes e build antes do commit;
6. publicar em main e validar o deployment de produção.

Não remova a autenticação Supabase permanentemente. Deixe a mudança reversível
para reativação antes do lançamento público.

Critérios de aceite:
- janela anônima abre /app sem formulário de login;
- GET /api/executar/projects retorna 200;
- GET /api/auth/me não retorna 500;
- /mcp não apresenta request.headers.get is not a function;
- não há FUNCTION_INVOCATION_FAILED;
- nenhum segredo aparece no frontend.
```

## Smoke test após o deployment

```bash
curl -i https://executar-ai.vercel.app/api/auth/me
curl -i https://executar-ai.vercel.app/api/executar/projects
curl -i https://executar-ai.vercel.app/mcp
```

Abra também `https://executar-ai.vercel.app/app` em janela anônima.

## Risco temporário aceito

Enquanto o modo sem login estiver ativo, qualquer pessoa com a URL poderá
acessar o workspace público compartilhado. Reative autenticação e isolamento
antes do lançamento externo.
