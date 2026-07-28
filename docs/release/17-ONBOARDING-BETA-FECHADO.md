# 17 — Onboarding de Beta Fechado (G6)

## Achado: o fluxo já existe e já funciona, sem código novo

Antes de propor construir algo, verifiquei o que já está implementado.
Resultado: **o onboarding completo de auto-provisionamento de workspace já
existe** e não precisava ser construído — `supabase/migrations/202607230001_phase4_workspace_rls.sql:167-201`
define uma trigger Postgres (`app.create_personal_workspace`, disparada por
`on_auth_user_created_create_workspace` em `auth.users`) que, a cada novo
cadastro no Supabase Auth, automaticamente:

1. cria um workspace pessoal (`public.workspaces`);
2. adiciona o novo usuário como `OWNER` desse workspace
   (`public.workspace_memberships`).

O restante do caminho já está implementado e testado nesta sessão:

- `web/src/pages/Login.tsx` — cadastro por e-mail/senha ou Google;
- após o cadastro, `prepareWorkspaces()` chama `/api/auth/workspaces`,
  encontra a única membership (o workspace recém-criado pela trigger) e,
  como só existe uma, entra direto (`chooseWorkspace`) sem exigir escolha
  manual;
- `POST /api/auth/session` grava a sessão de app (cookie `executa_session`);
- `App.tsx` carrega os projetos do workspace e mostra o produto.

**Isso já satisfaz o critério de "onboarding em até 3 passos visíveis"**
(regra de produto do `AGENTS.md`): abrir o link → criar conta → já está no
workspace, sem etapa de escolha ou configuração manual no caminho comum de
1 workspace por pessoa.

## O que genuinamente falta — e por quê não posso resolver sozinho

O único critério de saída do G6 que não pode ser satisfeito por código é:
**"pelo menos 1 usuário externo completou onboarding"**. Isso exige uma
pessoa real, fora desta sessão, executando o fluxo — não é algo que eu
possa simular ou declarar concluído por leitura de código.

### Teste de 5 minutos para você rodar hoje

1. Abra `https://executar-ai.vercel.app/entrar` numa janela anônima.
2. Crie uma conta com um e-mail real que você controle (ou peça a alguém
   de confiança para fazer isso, é o "usuário externo").
3. Confirme que, sem nenhuma etapa extra, a pessoa cai direto no workspace
   dela (não no workspace público, não em um formulário de configuração).
4. Grave a tela ou tire prints — essa é a evidência que fecha
   `EXA-G6-REL-001` e o item "Onboarding de beta fechado funcional" do
   checklist.

**Pré-requisito**: `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` precisam estar
configuradas no ambiente testado (ver `04-RISCOS-DECISOES.md` DEC-001) —
se não estiverem, o cadastro real falha antes mesmo de chegar na trigger.

## Convite para beta fechado — não precisa de código novo

Como o cadastro já é self-service e o workspace é auto-provisionado, "convite"
para o beta fechado não é um mecanismo técnico (token de convite, e-mail
transacional) — é **curadoria de quem recebe o link**, exatamente como já
está desenhado em `14-PLANO-GTM.md` §B: uma lista pequena e deliberada
cobrindo os 3 ICPs candidatos, contatada pessoalmente por você, não uma
campanha aberta. Isso é trabalho do dono do produto (`EXA-G6-GTM-001`), não
de engenharia — a infraestrutura para receber essas pessoas já está pronta.

Se, depois do beta, ficar claro que é necessário um controle técnico de
acesso mais fino (aprovação manual antes do primeiro login, lista de
e-mails permitidos), isso vira uma decisão e um item de escopo novo — não
existe hoje e não deveria ser construído antes de haver sinal de que é
necessário.
