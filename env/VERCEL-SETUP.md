# Configuração final na Vercel

Projeto: `executar-ai`  
Equipe: `oexecutor-9118s-projects`

Abra:

`https://vercel.com/oexecutor-9118s-projects/executar-ai/settings/environment-variables`

## 1. Token GitHub

Crie um fine-grained personal access token no GitHub com acesso apenas ao
repositório `oexecutor/P1.Executar.ai`.

Permissões mínimas:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Cadastre como variável sensível:

`EDITORIAL_GITHUB_TOKEN`

## 2. Token Vercel

Crie um token Vercel com acesso à equipe `oexecutor-9118s-projects`.
Ele é usado somente para consultar deployments do projeto.

Cadastre como variável sensível:

`EDITORIAL_VERCEL_TOKEN`

## 3. Valores finais não secretos

```text
EDITORIAL_GITHUB_REPOSITORY=oexecutor/P1.Executar.ai
EDITORIAL_GITHUB_BASE_BRANCH=main
EDITORIAL_VERCEL_PROJECT_ID=prj_vA765A0ctnjhBILMEe9Mw5ClWuJu
EDITORIAL_VERCEL_TEAM_ID=team_td1WYpI56N0p0CFjzY9iMD5L
PUBLIC_BASE_URL=https://executar-ai.vercel.app
```

Escopo recomendado:

- `Production`: todas as seis variáveis.
- `Preview`: as seis variáveis, mas `PUBLIC_BASE_URL` deve refletir a origem
  do ambiente ou ser resolvida pelo runtime.
- `Development`: somente se a E2 for testada localmente.

## 4. Aplicar

Depois de salvar as variáveis, faça redeploy do commit atual de `main`. As
variáveis não são adicionadas retroativamente aos deployments existentes.

## 5. Validar

No painel Editorial, abra `PUB-20260728-b4fbb3cc` e execute:

1. Criar artefato e iniciar Preview.
2. Atualizar status até `PREVIEW_READY`.
3. Iniciar revisão e aprovar.
4. Publicar.
5. Emitir os quatro QR semânticos.

Não envie os tokens pelo chat, não os coloque em Issue/PR e não os grave em
arquivos versionados.
