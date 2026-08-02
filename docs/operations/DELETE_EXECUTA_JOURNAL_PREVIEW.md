# Gate de exclusão — `executa-journal-preview`

**Data da auditoria:** 2 de agosto de 2026  
**Projeto que será excluído manualmente:** `executa-journal-preview`  
**ID Vercel legado:** `prj_SMaYVWIDqomDGV4hYYjtwQGMAabv`  
**Projeto canônico:** `executar-ai`  
**ID Vercel canônico:** `prj_vA765A0ctnjhBILMEe9Mw5ClWuJu`  
**Repositório canônico:** `oexecutor/P1.Executar.ai`  
**Domínio canônico:** `https://executar-ai.vercel.app`  
**Gate de código validado:** `f5fd89e2ffddaf9851ee10fffdaec73f3173de5a`

## Decisão

O projeto `executa-journal-preview` não contém um produto, repositório ou banco independente. Ele era uma segunda integração Vercel compilando o mesmo repositório GitHub do `executar-ai`.

O conteúdo, as APIs, o Journal, as publicações, os materiais de impressão, os QRs, a autenticação e a persistência passam a ter uma única origem operacional:

```text
GitHub:   oexecutor/P1.Executar.ai
Vercel:  executar-ai
Web:     https://executar-ai.vercel.app
Banco:   Supabase qynpcucdaeupwtdxnhih
```

## Evidências de migração concluída

### Código e conteúdo

- Não existe repositório GitHub separado para Journal ou Preview.
- Os dois projetos Vercel usavam `oexecutor/P1.Executar.ai`.
- O Journal e seus artigos respondem no domínio canônico.
- Os materiais QR e seus SVGs respondem no domínio canônico.
- O CI valida que nenhuma referência ao projeto legado aparece fora dos arquivos temporários de desativação listados abaixo.

### Banco e armazenamento Supabase

Foi executada uma varredura por `executa-journal-preview` em todas as tabelas-base dos schemas:

- `public`
- `auth`
- `storage`

**Resultado:** zero ocorrências.

A consulta reproduzível está em:

```text
docs/operations/sql/verify-no-legacy-journal.sql
```

Isso cobre publicações, eventos, rotas QR, tokens, workspaces, projetos, tarefas, evidências, sessões, identidades, buckets e objetos de storage armazenados no Supabase.

### Vercel

- O projeto canônico `executar-ai` possui Supabase e Postgres configurados.
- O deployment canônico do commit de consolidação ficou `READY`.
- `/health` responde `200` no domínio canônico.
- Não foram encontrados erros recentes de runtime no projeto canônico.
- O projeto legado não possui domínio personalizado; possui apenas aliases `vercel.app` gerados pela Vercel.
- Nos últimos sete dias, o único acesso atual observado no projeto legado foi uma chamada a `/health`.
- O histórico do legado contém 11 falhas em `/api/executar`, `/api/vault` e `/api/editorial` por ausência de conexão Postgres. Isso confirma que ele não era a instância persistente válida.
- Novos builds do legado são interrompidos pelo `Ignored Build Step`.

### Referências públicas

A busca pública exata pelos três aliases conhecidos do projeto legado não retornou resultados indexados.

## Endereços legados

Enquanto o projeto ainda existir, estes endereços funcionam apenas como ponte permanente `308`:

```text
https://executa-journal-preview.vercel.app
https://executa-journal-preview-oexecutor-9118s-projects.vercel.app
https://executa-journal-preview-git-main-oexecutor-9118s-projects.vercel.app
```

A ponte preserva caminhos, incluindo artigos, diretórios de impressão e SVGs relativos.

## Limite técnico após a exclusão

Aliases `*.vercel.app` pertencem ao projeto que os criou. Eles não podem ser transferidos para `executar-ai`.

Depois da exclusão física, os três endereços acima deixarão de responder. Isso não afeta o aplicativo, o banco ou os QRs atuais, porque as referências controladas pelo código e pelo banco usam o domínio canônico.

Marcadores antigos, mensagens já enviadas ou QRs externos que tenham sido criados manualmente com o domínio legado não podem ser descobertos ou corrigidos automaticamente. A auditoria confirmou que não há ocorrências nos sistemas controlados pelo projeto nem em resultados públicos indexados.

## Arquivos temporários que permanecem até a exclusão

Estes arquivos existem somente para evitar novos builds e manter a ponte durante a janela anterior à exclusão:

```text
vercel.json
scripts/vercel-ignore-duplicate.mjs
```

Eles não contêm dados, conteúdo editorial ou configuração necessária ao projeto canônico.

## Duas checagens de painel antes de excluir

Os conectores utilizados nesta auditoria não expõem a leitura de segredos Vercel nem a configuração administrativa de URLs do Supabase Auth. Portanto, confirme visualmente apenas estes dois pontos:

### 1. Vercel — variáveis do projeto legado

Em `executa-journal-preview → Settings → Environment Variables`:

- confirme que não existe uma variável exclusiva que precise ser preservada;
- não copie valores secretos para mensagens ou documentação;
- o projeto canônico já está operacional com Supabase e Postgres, portanto qualquer variável existente no legado é, por padrão, redundante ou incompleta;
- o histórico comprova que o legado não possuía conexão Postgres válida.

### 2. Supabase — URL principal de autenticação

Em `Authentication → URL Configuration`:

```text
Site URL:
https://executar-ai.vercel.app

Redirect URLs necessárias:
https://executar-ai.vercel.app/**
https://*-oexecutor-9118s-projects.vercel.app/**
http://localhost:3000/**
```

Remova uma URL exata do Journal caso ela exista. O wildcard de previews pode permanecer, porque também atende branches legítimas do projeto canônico.

## Procedimento manual de exclusão

Na Vercel:

1. Abra o projeto `executa-journal-preview`.
2. Confirme que o ID é `prj_SMaYVWIDqomDGV4hYYjtwQGMAabv`.
3. Execute as duas checagens de painel descritas acima.
4. Abra **Settings → General**.
5. Vá até **Delete Project**.
6. Exclua somente `executa-journal-preview`.
7. Não exclua `executar-ai`.

## Validação imediatamente após excluir

O projeto canônico deve continuar apresentando:

```text
https://executar-ai.vercel.app/health                          → 200
https://executar-ai.vercel.app/blog                            → 200
https://executar-ai.vercel.app/app                             → 200
https://executar-ai.vercel.app/print/qr/PUB-20260728-b4fbb3cc/ → 200
```

## Limpeza pós-exclusão

Depois que a exclusão manual for confirmada, remover em um último commit:

1. `ignoreCommand` de `vercel.json`;
2. redirects condicionados aos hosts legados;
3. `scripts/vercel-ignore-duplicate.mjs`;
4. os quatro caminhos temporários permitidos pelo verificador;
5. atualizar o verificador para exigir zero referências legadas em todo o repositório.

Até essa limpeza final, os controles temporários são inofensivos para `executar-ai` e impedem que o projeto legado volte a consumir builds.
