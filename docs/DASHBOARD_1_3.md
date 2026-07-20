# Dashboard integrado — versão 1.3.0

## Navegação principal

| Aba | Função |
| --- | --- |
| Dashboard | Métricas, importação/exportação, conector MCP e mapa do projeto |
| Notas | Arquivos `.md` e `.markdown`, leitura formatada, criação e edição |
| Documentos | Demais formatos; edição somente quando o arquivo é texto seguro |

## Leitura e edição

1. O catálogo retorna apenas metadados e links.
2. Ao abrir um arquivo, o painel solicita seu conteúdo individualmente.
3. Markdown é renderizado no servidor com HTML escapado.
4. O botão **Editar** aparece somente para texto de até 1 MB.
5. O salvamento envia `path`, `content` e `expectedSha256`.
6. Se a revisão mudou, a API retorna `409 CONFLICT` e não sobrescreve o arquivo.

## Hiperlinks MCP

- Nota: `/?tab=notes&path=<caminho>`
- Documento: `/?tab=documents&path=<caminho>`
- Texto bruto: `/view?path=<caminho>&raw=1`
- Download: `/view?path=<caminho>&download=1`

Links antigos para `/view?path=...` redirecionam para a aba integrada, preservando compatibilidade.

## Mapa do projeto

O dashboard identifica as pastas de primeiro nível existentes no vault. Para nomes conhecidos do diretório DESK-OS, apresenta uma descrição contextual. As contagens de notas, documentos e subpastas são calculadas a partir do catálogo real.
