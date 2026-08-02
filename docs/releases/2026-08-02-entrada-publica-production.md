# Release de produção — entrada pública sem login

Data: 2026-08-02
Projeto Vercel: `executar-ai`

## Artefato aprovado

- PR: `#49`
- Commit de runtime aprovado: `9dfd435782c917240fd75109c14d99d71bc03836`
- Mudança: entrada gratuita com geração de plano por IA ou importação de JSON, Markdown e TXT.
- Autenticação: Supabase Auth anônimo, sem login visível e sem workspace público compartilhado.

## Motivo deste commit

O primeiro webhook de produção foi recusado pela Vercel por `build-rate-limit`. Este registro não altera o runtime; ele cria um novo evento Git rastreável para repetir a promoção do mesmo código aprovado quando a capacidade de build estiver disponível.

## Gates de validação pós-deploy

1. Confirmar que o deployment de produção aponta para este commit de release e contém o runtime do commit aprovado acima.
2. Validar `/`, `/app`, `/api/health` e `/api/auth/config`.
3. Confirmar sessão anônima, criação de workspace isolado e persistência após refresh.
4. Validar geração por IA e importação de projeto.
5. Manter o deployment de produção anterior como rollback até a homologação terminar.
