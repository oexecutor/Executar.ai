# E4 — QR Router semântico P0

Status: **IMPLEMENTADO NO CÓDIGO; AGUARDA HOMOLOGAÇÃO HUMANA**

Issue canônica: [#23](https://github.com/oexecutor/P1.Executar.ai/issues/23)

## Decisão de arquitetura

P0 é a prioridade. A fase canônica continua sendo **E4**, depois de aprovação,
merge e publicação na E3.

O papel recebe uma URL estável:

```text
https://<origem-canônica>/q/qr_<identificador-opaco>
```

O token:

- não contém URL de Vercel, GitHub, analytics ou outro fornecedor;
- não contém usuário, e-mail, workspace, publicação ou segredo;
- não expira dentro do papel; pode ser revogado no registro;
- identifica somente uma rota registrada com intenção semântica;
- permanece igual quando o destino atual muda.

## Intenções

| Código | Intenção | Resolução |
|---|---|---|
| QR-01 | `CREATE` | abre o intake editorial; o `GET` não cria publicação |
| QR-02 | `PREVIEW` | abre o Preview do mesmo commit ou um fallback seguro |
| QR-03 | `APPROVE` | abre contexto de revisão autorizado; não aprova, não faz merge e não publica |
| QR-04 | `ANALYTICS` | abre a trilha editorial; métricas completas permanecem na E6 |

`CREATE`, `APPROVE` e `ANALYTICS` usam a política
`AUTHENTICATED_CONTEXT`. `PREVIEW` usa `PUBLIC_REDIRECT`.

## Persistência e auditoria

`editorial_qr_routes` registra:

- workspace e ambiente;
- publicação;
- ação;
- token opaco;
- estado `ACTIVE | REVOKED`;
- política de acesso;
- ator e data de emissão.

O destino não é persistido nessa tabela. A cada acesso, o router consulta o
documento atual de `EditorialPublication`.

`editorial_qr_access_events` registra apenas:

- ID do evento;
- token da rota;
- horário;
- resultado `REDIRECTED | SAFE_FALLBACK | REVOKED`.

Não são gravados IP, user agent, e-mail ou parâmetros brutos de rastreamento.

## Interface e fallback

Depois de `PUBLISHED`, a interface oferece:

```text
[Emitir quatro QRs semânticos]
```

Após a emissão, cada QR mostra imagem SVG, rótulo e o link alternativo:

```text
Continuar tarefa atual neste dispositivo.
```

O QR nunca é o único caminho disponível.

## Proteções P0

- emissão somente depois de `PUBLISHED`, com confirmação explícita;
- quatro ações obrigatórias, distintas e idempotentes;
- QR-03 é navegação `GET`, nunca mutação;
- resolução não aceita destino enviado pelo scanner;
- Preview precisa corresponder ao commit GitHub; caso contrário usa fallback;
- token inválido retorna `404` genérico;
- token revogado retorna `410` genérico;
- emissão falha move para `QR_FAILED` sem desfazer a publicação;
- migração é expand-only e exclusão da publicação remove rotas e acessos por
  cascata.

## Verificação automatizada

- domínio, API, registro Postgres e compatibilidade;
- geração real de SVG com correção de erro M e quiet zone;
- resolução por intenção e mudança de destino sem troca de token;
- ausência de mutação ao abrir QR-03;
- fallback de Preview, token ausente e token revogado;
- interface, acessibilidade e ausência de overflow em viewport mobile;
- Playwright cobrindo emissão, quatro fallbacks e navegação de QR-03.

## GAP explícito

A leitura óptica em celular físico e o posicionamento em painel A4 pertencem ao
aceite E5. Teste de browser não substitui esse ensaio. Até a leitura física ser
registrada, não alegar homologação de impressão.

## Rollback

1. desabilitar o botão de emissão na interface;
2. remover o rewrite `/q/:token` da versão em rollback;
3. restaurar o commit anterior pela trilha Git/Vercel;
4. manter as tabelas expand-only sem apagar tokens ou evidências;
5. não reverter `PUBLISHED`, porque falha de QR não desfaz publicação.
