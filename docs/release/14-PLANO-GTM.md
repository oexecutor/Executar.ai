# 14 — Plano de GTM (Go-to-Market)

> Este documento preenche uma lacuna real do pacote de release: `00`–`13`
> são rigorosos no lado técnico (Gates G0–G10, riscos, testes), mas não
> existia nenhum plano de posicionamento, público-alvo, monetização ou
> canais de lançamento. `docs/02_PRODUCT_VISION_AND_SCOPE.md` define como
> único usuário nomeado o próprio fundador (Leonardo Batista) e o MVP
> exclui explicitamente billing multiusuário — mas a arquitetura já
> construída (workspaces, OAuth, RLS no Supabase) é capaz de multiusuário.
> Ou seja, a decisão de modelo de negócio nunca foi tomada de forma
> explícita, apesar do código já apontar em uma direção. Este plano não
> cria uma linha do tempo paralela — cada fase é ancorada em um Gate já
> existente em `01-ROADMAP-LANCAMENTO.md`.

## A. Framework de decisão de modelo de negócio

Três caminhos, avaliados contra o MVP atual e a arquitetura já pronta:

| Caminho | Descrição | Esforço adicional | Risco |
|---|---|---|---|
| (i) Ferramenta pessoal + build-in-public | Continua sendo o motor de execução do próprio Leonardo; "GTM" é audiência/conteúdo via EXECUTA Journal, não vendas | Baixo — já é o estado atual | Baixo |
| (ii) Híbrido — beta fechado depois de G6/G7 | Uso pessoal agora; abre para um grupo pequeno convidado (pago ou não) depois do beta fechado já roteirizado no roadmap técnico | Médio — precisa de fluxo de convite (já é entregável do G6) + decisão de billing adiada | Médio, mitigável |
| (iii) SaaS multiusuário pago desde o lançamento público (G9) | Abre para clientes externos pagantes no G9, com billing e aquisição de clientes real | Alto — precisa de billing, pricing validado, suporte real, terms/privacy jurídicos antes de qualquer usuário pagante | Alto — nenhum desses pré-requisitos existe hoje |

**Recomendação desta auditoria: caminho (ii), híbrido.** Motivos:

- reaproveita o **G6 — Beta fechado**, que já existe no roadmap técnico
  como gate formal, sem precisar inventar um processo novo;
- adia a decisão de billing/pricing para depois de validar retenção com
  usuários reais — decidir monetização sem nenhum dado de uso é a forma
  mais comum de errar preço e proposta de valor;
- não contradiz a decisão histórica de "sem tela de login" para o uso
  atual (ver `13-AUDITORIA-RIGOROSA-2026-07-28.md` §5, DEC-001) — o modo
  público pode continuar para demonstrações enquanto o beta fechado usa
  autenticação real apenas para os convidados;
- mantém compatível com (i) se a decisão final for não comercializar: o
  trabalho de posicionamento e conteúdo do EXECUTA Journal não é
  desperdiçado em nenhum dos três caminhos.

**Critério explícito de graduação para (iii)**: pelo menos 5 usuários
externos ativos no beta fechado por 30 dias corridos, com pelo menos 1
sinal de disposição a pagar coletado em entrevista (não em pesquisa
hipotética). Sem isso, permanecer em (ii) indefinidamente é uma opção
válida, não uma falha.

## B. Posicionamento e ICP candidatos

**Mensagem central** (derivada de `02_PRODUCT_VISION_AND_SCOPE.md`):

> EXECUTA.AI transforma contexto disperso — notas, ideias, documentos,
> obrigações — em trabalho estruturado, com a próxima ação sempre visível,
> evidência ligada a cada decisão e execução que pode ser retomada sem
> reconstruir o contexto do zero.

Diferenciação real (não aspiracional): motor 3 fases × 9 áreas × 36 itens
já implementado e testado; MCP nativo (não é um chatbot com plugin, é um
servidor MCP de primeira classe com OAuth 2.1); desenhado para operação
neuroinclusiva (um workflow por dia, três passos visíveis, sem sobrecarga
de opções) — isso é uma escolha de produto explícita, não um jargão de
marketing, e aparece em regras concretas de UX (`AGENTS.md`).

**Três ICPs candidatos a validar no beta fechado** (não escolher um só
antes de ter conversas reais — o beta fechado é exatamente o instrumento
para descobrir qual ressoa):

1. **Indie hackers / solo founders que já usam agentes de IA (Claude,
   MCP) para gestão de projeto.** Já entendem o valor de um MCP nativo,
   já sofrem com ferramentas de PM genéricas demais. Canal natural:
   comunidades de build-in-public, X/Twitter, Indie Hackers.
2. **Profissionais neurodivergentes buscando estrutura e próxima ação
   visível**, cansados de ferramentas de PM com excesso de opções e
   configuração. Canal natural: comunidades de produtividade
   neurodivergente, não comunidades técnicas genéricas.
3. **Usuários avançados de PKM/Obsidian** que já têm o hábito de capturar
   notas e querem uma camada de execução sobre elas, sem trocar de
   ferramenta de captura. Canal natural: comunidade Obsidian, r/ObsidianMD,
   newsletters de PKM.

**Ação concreta**: a lista de convidados do beta fechado (`EXA-G6-REL-001`
em `01-ROADMAP-LANCAMENTO.md`) deve deliberadamente incluir pessoas dos
três grupos, não só a rede pessoal do fundador — é o único jeito barato de
testar as três hipóteses de ICP ao mesmo tempo.

## C. Hipótese de monetização (condicional ao caminho ii/iii)

Não é um compromisso de preço — é uma hipótese a validar em entrevista
durante o beta fechado, antes de qualquer implementação de billing:

| Tier | Hipótese | Quando cobrar |
|---|---|---|
| Gratuito/demo | Workspace de demonstração (`ALLOW_PUBLIC_WORKSPACE_FALLBACK`), sem persistência garantida de longo prazo | Nunca — é a porta de entrada |
| Individual | Workspace próprio autenticado, persistência garantida, MCP completo | Só depois de sinal real de disposição a pagar no beta |
| Founder/early adopter | Desconto vitalício para os primeiros convidados do beta que continuarem após ele | Alinhado ao lançamento público (G9), se o caminho (iii) for confirmado |

**Provedor de pagamento: Stripe** — decidido pelo dono do produto em
2026-07-28. Isso resolve a única decisão de infraestrutura de billing que
faltava, mas **não autoriza construir a integração agora**: nenhuma
implementação de checkout/assinatura deve começar antes de (a) o beta
fechado validar que pelo menos um dos tiers acima tem demanda real, e (b)
existir uma conta Stripe real com chaves de API — esta sessão não tem
acesso a credenciais Stripe e não vai fabricar uma integração que não pode
funcionar de verdade. Quando essas duas condições existirem, a
implementação é: Stripe Checkout (não construir formulário de cartão
próprio), webhook `checkout.session.completed`/`customer.subscription.*`
para sincronizar o `role`/tier do workspace, e chaves apenas como variável
de ambiente server-only (nunca `VITE_`), seguindo o mesmo padrão de
segredo já usado para `SUPABASE_SERVICE_ROLE_KEY` e `MCP_JWT_SECRET`.

## D. Plano de canais por fase (ancorado nos Gates existentes)

| Fase | Gate correspondente | Ação de GTM |
|---|---|---|
| Pré-lançamento | G0–G5 | Construir em público via EXECUTA Journal (já integrado); publicar 1–2 artigos por semana sobre o motor 3×9×36, checkpoints e evidência — o próprio blog já é o canal, só falta cadência editorial; abrir uma lista de interesse simples (nem precisa ser feature nova — link externo ou formulário básico) |
| Beta fechado | G6 | Outreach direto e pessoal (não campanha) para uma lista curta cobrindo os 3 ICPs candidatos (§B); onboarding em até 3 passos visíveis (regra já existente em `AGENTS.md`, critério de aceite do próprio G6) |
| Preparação comercial | G7 | Definir pricing (se caminho ii/iii confirmado), suporte, jurídico — já são entregáveis do G7; adicionar decisão de GTM (qual caminho A/B/C) como critério de saída do G7 |
| RC / Lançamento | G8–G9 | Show HN, Product Hunt, comunidades específicas de PKM/ferramentas de IA (não lançamento genérico) — mensagem de lançamento já é item pendente do checklist (`05-CHECKLIST-LANCAMENTO.md`, seção Comunicação) |
| Pós-lançamento | G10 | Loop de retenção e ajuste de mensagem por dados reais de ativação, usando a cadência de revisão 24h/7d/30d já definida em `08-OPERACAO-POS-LANCAMENTO.md` |

A automação editorial E2 (branch → PR → Vercel Preview automático, hoje
`NO-GO` per `12-HOMOLOGACAO-E2-2026-07-28.md`) **não bloqueia** nenhuma
fase acima — publicar artigos hoje já funciona pelo fluxo manual/E1; a
automação é conveniência operacional, não pré-requisito de GTM.

## E. Métricas de sucesso

`08-OPERACAO-POS-LANCAMENTO.md` já registra como LACUNA a ausência de
instrumentação de ativação/retenção. Este plano propõe o mínimo necessário
antes do G6 (beta fechado), não antes — instrumentar cedo demais mede
ruído do próprio fundador usando o produto, não sinal real:

- **Ativação**: primeiro projeto criado + primeiro checkpoint concluído,
  por usuário convidado do beta.
- **Retenção semanal**: usuário volta e conclui ao menos uma ação em uma
  semana diferente da primeira.
- **Qualitativo**: uma entrevista curta com cada convidado do beta após a
  primeira semana de uso — pergunta central: "o que você fez essa semana
  que não teria feito (ou teria feito pior) sem isso?"

Essas três métricas alimentam diretamente a "Revisão após 7 dias" e
"Revisão após 30 dias" já definidas em `08-OPERACAO-POS-LANCAMENTO.md`,
sem criar um sistema de métricas paralelo.

## Resumo executivo

- Caminho recomendado: **híbrido (ii)** — beta fechado convidado depois de
  G6/G7, decisão de comercialização plena adiada até ter sinal real.
- **Atualização 2026-07-28**: autenticação real e Supabase como persistência
  canônica já foram aprovados e implementados (ver
  `13-AUDITORIA-RIGOROSA-2026-07-28.md` §5 e `04-RISCOS-DECISOES.md`
  DEC-001/DEC-002) — deixam de ser pré-requisito futuro do G6 e passam a
  ser estado atual do produto. Stripe foi decidido como provedor de
  pagamento (§C), mas a integração de billing em si continua bloqueada até
  o beta validar demanda e existir uma conta Stripe real configurada.
- Próxima ação concreta, sem esperar nenhuma outra decisão: montar a lista
  de convidados do beta cobrindo os 3 ICPs candidatos (§B) — isso pode
  começar hoje, é trabalho do dono do produto, não de engenharia.
