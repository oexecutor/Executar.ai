# language: pt
Funcionalidade: Sistema Editorial Responsivo e Adaptativo Multiformato (AMES)
  Como operador ou agente de IA
  Quero adaptar um único conteúdo entre formatos sem perda silenciosa
  Para que a saída seja legível, rastreável e auditável

  Contexto:
    Dado um modelo de conteúdo válido contra "content-model.schema.json"
    E o perfil de estilo "classic-swiss-editorial"
    E os tokens referenciados por ID de "TOK-DESKGO-SWISS-001"

  @TEST-OUT-01 @FR-003
  Cenário: Toda saída de gate tem exatamente uma decisão e uma ação
    Quando o gate "G0" é concluído
    Então a saída contém exatamente uma decisão em {AVANÇAR, CORRIGIR, PAUSAR, ENCERRAR}
    E a saída contém exatamente uma próxima ação

  @TEST-TR-02 @EDR-006 @ACR-017
  Cenário: SCALE não pode resolver overflow
    Dado um conteúdo que excede o orçamento do formato "pamphlet-99x210"
    Quando o sistema adapta o conteúdo
    Então o sistema NÃO reduz a fonte abaixo do mínimo do perfil
    E o sistema aplica REPRIORITIZE, SUBSTITUTE ou PAGINATE
    E registra behavior, justificativa e impacto

  @TEST-TR-04 @DR-001
  Cenário: Repriorização preserva P0 e P1
    Dado blocos com prioridades P0, P1, P2, P3 e P4
    Quando o formato "widget" impõe orçamento de 1 métrica
    Então os blocos P0 e P1 permanecem visíveis
    E os blocos P3 e P4 vão para detalhe, QR ou apêndice

  @TEST-AI-01 @FR-005
  Cenário: Saída visual acompanha dados estruturados
    Quando o sistema gera um artefato visual
    Então existe um par de dados estruturados referenciado em "parallel_structured_data"
    E um agente responde sem OCR

  @TEST-A11Y-05 @ACC-002 @ACR-004
  Cenário: Estado não depende só de cor
    Dado um estado de acesso de um item
    Então o estado usa um rótulo textual normalizado em {ACCESSIBLE, ACCESSIBLE_WITH_WARNING, OUTSIDE_CONTAINER, MISSING, INVALID}
    E permanece compreensível em escala de cinza

  @TEST-PRINT-06 @PRINT-005 @ACR-019
  Cenário: P-1 não é declarado como arquivo de gráfica
    Dado uma exportação por navegador (P-1)
    Quando o usuário solicita produção profissional
    Então o sistema exige o pipeline P-2 com PDF/X, CMYK, ICC, sangria, fontes incorporadas e preflight
    E não declara a exportação P-1 como pronta para gráfica

  @TEST-SWISS-04 @SWISS-005 @ACR-008
  Cenário: Perfil Swiss sem decoração indevida
    Quando a composição usa "classic-swiss-editorial"
    Então não há pills, emojis, sombras, gradientes ou glassmorphism
    E cada cor tem um único papel semântico
    E o accent ocupa no máximo 5% da área

  @TEST-FMT-05 @ACC-005
  Cenário: Business Model Canvas tem alternativa linear
    Dado o formato "business-model-canvas"
    Quando o alvo é "mobile"
    Então existe uma representação linear navegável por bloco

  @TEST-TOKEN-01 @NFR-004 @TK-002
  Cenário: Nenhum valor visual hard-coded
    Quando um componente é especificado
    Então todo valor visual referencia um token por ID
    E nenhum valor cromático ou dimensional é literal no componente

  @TEST-GOV-01 @GO-001 @SEC-001
  Cenário: Ação externa exige aprovação
    Quando o sistema tentaria escrever ou publicar externamente
    Então a ação é bloqueada
    E a decisão é PAUSAR aguardando aprovação
