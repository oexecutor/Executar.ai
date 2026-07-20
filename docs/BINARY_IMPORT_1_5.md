# DESK-OS MCP v1.5.0 — Importação binária pelo Claude

## Nova ferramenta

`obsidian_import_binary`

Armazena no vault remoto os bytes exatos de um arquivo recebidos em Base64. Foi criada para pacotes de Skills, arquivos ZIP, PDF, imagens e outros formatos não textuais.

## Contrato de entrada

| Campo | Obrigatório | Uso |
| --- | --- | --- |
| `path` | sim | Caminho final no vault, incluindo nome e extensão. |
| `dataBase64` | sim | Bytes exatos em Base64 padrão, URL-safe ou data URL. |
| `mimeType` | não | Ex.: `application/zip`. |
| `originalName` | não | Nome original para metadados de proveniência. |
| `overwrite` | não | Padrão `false`. |
| `expectedSha256` | ao substituir | Confirma a revisão atual do destino. |
| `expectedContentSha256` | não | Confere integridade ponta a ponta do arquivo recebido. |

## Limites

- máximo decodificado pelo MCP: 4.000.000 bytes;
- máximo aproximado do texto Base64: 5.600.000 caracteres;
- arquivos maiores devem usar o importador ZIP do dashboard;
- o arquivo é armazenado sem descompactação e sem interpretação;
- o ZIP não é executado, instalado ou ativado automaticamente.

## Exemplo de prompt no Claude

> Use o arquivo ZIP anexado sem alterar seus bytes. Importe-o com `obsidian_import_binary` para `98_MODELOS/Skills/minha-skill.zip`, MIME type `application/zip`. Depois devolva o SHA-256 e o hiperlink para download.

## Exemplo de argumentos MCP

```json
{
  "path": "98_MODELOS/Skills/minha-skill.zip",
  "dataBase64": "UEsDB...",
  "mimeType": "application/zip",
  "originalName": "minha-skill.zip",
  "overwrite": false
}
```

## Substituição segura

1. Liste o arquivo existente com `obsidian_list_entries`.
2. Copie o `sha256` atual.
3. Chame `obsidian_import_binary` com `overwrite: true` e `expectedSha256`.
4. A versão anterior será movida para a lixeira recuperável.

## Limitação do cliente Claude

A ferramenta funciona quando o cliente Claude disponibiliza ao modelo ou ao conector os bytes originais do anexo. Alguns clientes conseguem analisar um arquivo, mas não expõem o binário bruto em Base64 para uma chamada MCP. Nessa situação, o servidor não deve reconstruir um ZIP a partir de uma descrição textual; use o upload do dashboard como fallback.
