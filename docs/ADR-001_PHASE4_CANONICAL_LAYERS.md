# ADR-001 — Canonização por camada

Status: aceito para a Fase 4.

## Contexto

O pacote reúne código robusto, protótipos JSX, interface PM funcional, contratos, tokens, vault, MCP e referências visuais. Nenhuma pasta isolada representa todo o produto.

## Decisão

Canonizar por responsabilidade:

- metodologia 3–9–36 como contrato de domínio;
- Supabase Postgres, Auth e RLS como base multiusuário;
- serviços existentes de vault, workflow e PM como capacidades preservadas;
- JSX do EXECUTA Studio como referência de experiência;
- Forge Visual Canvas como método de composição visual;
- paleta cinza, laranja, preto e branco como autoridade da identidade;
- tokens como artefato derivado;
- API `/api/executar/*` e MCP `executar_*` sobre o mesmo store por workspace;
- migração incremental, sem reescrita total do back-end.

## Consequências

- a aplicação pode combinar ativos de pastas diferentes;
- cada responsabilidade termina com uma implementação oficial;
- a API PM permanece como compatibilidade temporária;
- a landing e o workspace compartilham identidade, mas não responsabilidades;
- o Preview pode ser validado sem tocar produção;
- novas telas devem consumir contratos de domínio, não formatos acidentais do legado.

## Alternativas rejeitadas

- promover uma pasta inteira como aplicação final;
- copiar o protótipo JSX diretamente para produção;
- manter acesso público ao vault;
- tratar tokens antigos como fonte visual absoluta;
- reescrever todos os serviços para adaptar o front-end;
- publicar diretamente em produção sem matriz de paridade e rollback.
