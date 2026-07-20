# DESK-OS Obsidian Cloud MCP — Netlify

Servidor MCP remoto e painel web integrado para trabalhar com um espelho em nuvem de um vault do Obsidian pelo Claude.ai, inclusive no iPad e iPhone.

## Produção

| Campo | Valor |
| --- | --- |
| Projeto Netlify | `desk-os-vault-mcp-openai` |
| Site ID | `88f72319-6890-45e8-a230-bddaa32fc07d` |
| Aplicação | `https://desk-os-vault-mcp-openai.netlify.app` |
| MCP | `https://desk-os-vault-mcp-openai.netlify.app/mcp` |
| API de arquivos | `https://desk-os-vault-mcp-openai.netlify.app/api/vault/files` |
| Dashboards vivos | `https://desk-os-vault-mcp-openai.netlify.app/dashboard` |

## Versão 1.6.0 — ingestão de workflow e dashboard vivo

Esta edição adiciona `desk_ingest_workflow_dashboard`, uma ferramenta de integração que recebe o estado estruturado de qualquer workflow e mantém um dashboard HTML vivo dentro do vault.

O catálogo passa a ter **19 ferramentas MCP**:

- 13 operações do vault;
- 6 workflows DESK-OS.

A cada ingestão, a ferramenta:

- atualiza itens por IDs estáveis ou substitui um snapshot completo;
- recalcula fontes, decisões aprovadas, lacunas, contraevidências e riscos;
- gera um painel responsivo inspirado no dashboard WorkOS Neuroadaptado;
- salva `WORKFLOW_STATUS.json`, `STATUS_DASHBOARD.html` e `DASHBOARD.md`;
- cria um snapshot histórico para auditoria;
- devolve um `dashboardUrl` clicável;
- protege atualizações concorrentes com `expectedStateSha256` quando informado.

O dashboard principal do vault agora detecta automaticamente painéis em `DESK-OS/Dashboards/Workflows/` e os mostra na seção **Dashboards dinâmicos**.

Consulte `docs/WORKFLOW_DASHBOARD_1_6.md` e o payload inicial em `templates/WORKOS_NEUROADAPTADO_INITIAL_PAYLOAD.json`.

## Versão 1.5.0 — importação binária pelo Claude

Esta edição mantém o acesso aberto da v1.4.0 e adiciona a ferramenta MCP `obsidian_import_binary` para armazenar pacotes ZIP, Skills, PDFs, imagens e outros binários recebidos como Base64. O catálogo passa a ter **18 ferramentas MCP**.

A importação binária:

- preserva os bytes originais;
- registra MIME type, nome original, tamanho e SHA-256;
- limita o arquivo a 4.000.000 bytes decodificados;
- não descompacta nem executa o pacote;
- exige confirmação da revisão para substituir um caminho existente;
- move a versão substituída para a lixeira recuperável.

Esta edição também remove todas as solicitações de senha ao usuário:

- Dashboard abre diretamente.
- Notas e documentos podem ser lidos e editados sem login.
- Importação e exportação não exigem sessão.
- OAuth valida cliente, redirect URI, recurso e PKCE, mas não pede senha.
- `ADMIN_PASSWORD` deixou de ser usada e deve ser removida da Netlify.
- `MCP_JWT_SECRET` permanece apenas como chave criptográfica interna para assinar tokens do protocolo; ela nunca é solicitada ao usuário.

## Fluxo de uso

1. Abra o painel diretamente.
2. Consulte métricas e importe um ZIP, quando necessário.
3. Abra a aba **Notas** ou **Documentos**.
4. Navegue por pastas ou pesquise pelo caminho.
5. Abra um arquivo para ler.
6. Em arquivos de texto de até 1 MB, selecione **Editar**.
7. Salve; o servidor compara o SHA-256 antes de aceitar a atualização.
8. Em caso de conflito, reabra o arquivo e reconcilie as alterações.
9. Exporte um ZIP antes de substituir o vault local do Obsidian.

## Aviso de acesso

Qualquer pessoa que conheça o endereço público poderá ler, criar, editar, importar e exportar o vault remoto. Não use esta edição para dados privados, confidenciais ou regulados.

## Publicação

```bash
npx netlify login
npx netlify link --id 88f72319-6890-45e8-a230-bddaa32fc07d
npx netlify deploy --build --prod
```


## Uso pelo Claude — arquivo binário

```text
Use o ZIP anexado sem alterar seus bytes.
Importe com obsidian_import_binary para:
98_MODELOS/Skills/minha-skill.zip
MIME type: application/zip
Depois retorne SHA-256 e hiperlink.
```

Consulte `docs/BINARY_IMPORT_1_5.md` para o contrato completo e as limitações do cliente Claude.
