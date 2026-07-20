# DESK-OS MCP v1.4.0 — Acesso aberto

Esta edição remove todas as solicitações de senha ao usuário.

## Comportamento

- Dashboard abre diretamente.
- Notas e documentos podem ser lidos e editados sem login.
- Importação e exportação do vault não pedem senha.
- OAuth do MCP autoriza automaticamente após validar cliente, redirect URI, recurso e PKCE.
- `ADMIN_PASSWORD` não é usada e deve ser removida da Netlify.
- `MCP_JWT_SECRET` permanece como chave criptográfica interna para assinar tokens OAuth; não é uma senha de usuário e nunca aparece na interface.

## Aviso

Qualquer pessoa com o endereço do projeto poderá ler, criar, editar, importar e exportar arquivos do vault remoto.
