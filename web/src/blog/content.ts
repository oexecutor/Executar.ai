import type { BlogCategory, BlogPost } from "./types";

export const blogCategories: BlogCategory[] = [
  "Método EXECUTA",
  "Produto",
  "IA e agentes",
  "Gestão de projetos",
  "Neurocompatibilidade",
  "Governança",
];

export const blogPosts: BlogPost[] = [
  {
    slug: "da-ideia-a-proxima-acao",
    title: "Da ideia à próxima ação: como o EXECUTA.AI estrutura projetos",
    excerpt:
      "Um contexto ainda incompleto pode virar um plano operável sem exigir que você decida tudo de uma vez.",
    category: "Método EXECUTA",
    publishedAt: "2026-07-23",
    readingMinutes: 6,
    featured: true,
    coverPattern: "steps",
    coverLabel: "01 / CONTEXTO → EXECUÇÃO",
    sections: [
      {
        heading: "O problema não é falta de informação",
        paragraphs: [
          "Projetos costumam começar com mensagens, documentos, referências e decisões ainda dispersas. Organizar esse material manualmente exige energia antes mesmo de o trabalho real começar.",
          "O EXECUTA.AI trata o contexto bruto como insumo. Em vez de pedir uma especificação perfeita, o sistema identifica fatos, lacunas, decisões e evidências para construir uma primeira estrutura verificável.",
        ],
      },
      {
        heading: "Estrutura antes de velocidade",
        paragraphs: [
          "A metodologia distribui o projeto em três fases e nove áreas. Cada área termina em um checkpoint, o que evita confundir atividade com avanço real.",
          "As tarefas exibem no máximo três ações visíveis. O objetivo não é esconder a complexidade do projeto, mas apresentar somente a complexidade necessária para a decisão atual.",
        ],
        bullets: [
          "uma entrega dominante por vez;",
          "até três ações executáveis;",
          "evidência associada ao avanço;",
          "checkpoint antes da próxima área.",
        ],
      },
      {
        heading: "A próxima ação como interface",
        paragraphs: [
          "Lista, tabela e Kanban continuam disponíveis, mas a tela Hoje responde primeiro à pergunta mais importante: o que precisa acontecer agora?",
          "Quando o estado muda no aplicativo, o agente consulta a mesma fonte. Não existe um plano no chat e outro no quadro.",
        ],
        callout:
          "Um bom sistema de execução não mostra tudo o tempo todo. Ele mostra a decisão certa no momento certo.",
      },
    ],
  },
  {
    slug: "por-que-3-fases-9-areas-36-itens",
    title: "Por que 3 fases, 9 áreas e 36 itens",
    excerpt:
      "A estrutura canônica cria previsibilidade sem transformar projetos diferentes em formulários idênticos.",
    category: "Gestão de projetos",
    publishedAt: "2026-07-21",
    readingMinutes: 7,
    coverPattern: "grid",
    coverLabel: "03 × 09 × 36",
    sections: [
      {
        heading: "Um esqueleto estável",
        paragraphs: [
          "O sistema usa três fases, nove áreas e quatro itens por área. Essa regularidade permite calcular progresso, dependências e gates de forma consistente.",
          "O conteúdo de cada tarefa continua adaptável ao contexto. O que permanece fixo é a lógica de passagem: compreender, construir e validar.",
        ],
      },
      {
        heading: "Três tarefas e um checkpoint",
        paragraphs: [
          "Cada área contém três tarefas de avanço e um checkpoint. O checkpoint verifica se o entregável existe e se há evidência suficiente para seguir.",
        ],
        bullets: [
          "tarefa 1: preparar o insumo;",
          "tarefa 2: executar a transformação;",
          "tarefa 3: consolidar o resultado;",
          "checkpoint: validar o entregável.",
        ],
      },
      {
        heading: "Comparabilidade sem rigidez",
        paragraphs: [
          "Projetos podem ter conteúdos muito diferentes e ainda compartilhar indicadores. Isso facilita portfólio, previsão e aprendizado entre ciclos.",
          "Quando uma área não se aplica, a decisão precisa ser registrada. O sistema evita excluir etapas silenciosamente.",
        ],
      },
    ],
  },
  {
    slug: "workspace-que-reduz-decisoes-desnecessarias",
    title: "Um workspace que reduz decisões desnecessárias",
    excerpt:
      "Neurocompatibilidade começa pela arquitetura da informação, não por um modo visual separado.",
    category: "Neurocompatibilidade",
    publishedAt: "2026-07-18",
    readingMinutes: 5,
    coverPattern: "signal",
    coverLabel: "CARGA ↓ / CLAREZA ↑",
    sections: [
      {
        heading: "Menos escolhas simultâneas",
        paragraphs: [
          "Uma interface pode ser tecnicamente completa e ainda assim exigir decisões demais. Escolher entre dezenas de cartões, estados e notificações consome capacidade antes da execução.",
          "O EXECUTA.AI organiza profundidade por camadas. A visão geral orienta, Hoje prioriza e as visões detalhadas ficam disponíveis quando são necessárias.",
        ],
      },
      {
        heading: "Consistência entre superfícies",
        paragraphs: [
          "O mesmo vocabulário aparece no plano, na lista e no Kanban. Estados não mudam de nome entre telas e ações importantes permanecem previsíveis.",
        ],
        bullets: [
          "foco visível por teclado;",
          "contraste suficiente;",
          "movimento reduzido respeitado;",
          "sem rolagem horizontal no fluxo principal.",
        ],
      },
      {
        heading: "Sem promessas clínicas",
        paragraphs: [
          "Neurocompatibilidade é tratada como decisão de produto e acessibilidade. O sistema não diagnostica, não promete tratamento e não usa urgência artificial para gerar engajamento.",
        ],
        callout:
          "Reduzir carga cognitiva é diminuir atrito operacional, não simplificar a capacidade da pessoa.",
      },
    ],
  },
  {
    slug: "cloud-mcp-pwa-mesma-fonte",
    title: "Cloud, MCP e PWA sobre a mesma fonte de dados",
    excerpt:
      "Como agentes e pessoas operam o mesmo projeto sem sincronizações frágeis ou estados paralelos.",
    category: "IA e agentes",
    publishedAt: "2026-07-15",
    readingMinutes: 8,
    coverPattern: "bridge",
    coverLabel: "CLOUD ↔ MCP ↔ PWA",
    sections: [
      {
        heading: "Uma operação, dois modos de acesso",
        paragraphs: [
          "O usuário trabalha pelo aplicativo. O agente trabalha pelas ferramentas MCP. Ambos chamam os mesmos serviços de domínio e persistem no mesmo workspace.",
          "Isso elimina o padrão em que a IA produz um plano que precisa ser copiado manualmente para outro sistema.",
        ],
      },
      {
        heading: "O workspace como fronteira",
        paragraphs: [
          "Cada leitura e escrita carrega um workspace identificado. Memberships e políticas RLS impedem que um usuário atravesse a fronteira de outro projeto ou organização.",
        ],
        bullets: [
          "autenticação pelo Supabase;",
          "membership validada no servidor;",
          "tokens MCP revalidados;",
          "service role restrita ao back-end.",
        ],
      },
      {
        heading: "Agentes com responsabilidade",
        paragraphs: [
          "Ferramentas destrutivas exigem confirmação. Mudanças relevantes registram evidência e respeitam o papel do usuário.",
          "A automação serve à governança do projeto; ela não substitui a fronteira de aprovação.",
        ],
      },
    ],
  },
  {
    slug: "checkpoints-progresso-verificavel",
    title: "Checkpoints: progresso não é apenas tarefa concluída",
    excerpt:
      "Uma barra de progresso só é útil quando existe uma regra clara para validar o que foi entregue.",
    category: "Método EXECUTA",
    publishedAt: "2026-07-11",
    readingMinutes: 5,
    coverPattern: "orbit",
    coverLabel: "GATE / EVIDÊNCIA",
    sections: [
      {
        heading: "Atividade não é resultado",
        paragraphs: [
          "Marcar tarefas pode aumentar um percentual sem reduzir o risco do projeto. Checkpoints criam uma pausa explícita para verificar entregável, critério e evidência.",
        ],
      },
      {
        heading: "O gate protege a próxima etapa",
        paragraphs: [
          "Uma área só avança quando seu checkpoint está validado. Quando há lacunas, o sistema mostra o que falta em vez de fingir que o projeto está pronto.",
        ],
        bullets: [
          "entregável identificado;",
          "critério de aceite explícito;",
          "evidência relacionada;",
          "decisão registrada.",
        ],
      },
      {
        heading: "Progresso explicável",
        paragraphs: [
          "O dashboard combina ações, tarefas e checkpoints. Assim, duas pessoas conseguem entender por que o projeto está em determinado estágio.",
        ],
      },
    ],
  },
  {
    slug: "evidencias-decisoes-historico-projeto",
    title: "Evidências e decisões: o histórico que o projeto precisa",
    excerpt:
      "Documentos deixam de ser anexos soltos quando passam a explicar decisões, riscos e entregáveis.",
    category: "Governança",
    publishedAt: "2026-07-08",
    readingMinutes: 6,
    coverPattern: "stack",
    coverLabel: "FATO / DECISÃO / GAP",
    sections: [
      {
        heading: "Um registro epistemológico",
        paragraphs: [
          "O sistema diferencia fato, evidência, inferência, hipótese, contraevidência, lacuna e decisão. Essa separação torna o raciocínio auditável.",
          "Uma hipótese pode orientar o próximo teste sem ser apresentada como verdade.",
        ],
      },
      {
        heading: "Documentos com contexto",
        paragraphs: [
          "O vault preserva notas e arquivos, mas cada evidência pode ser relacionada ao projeto, à tarefa ou ao checkpoint que ela sustenta.",
        ],
        bullets: [
          "origem identificada;",
          "data e responsável;",
          "relação com a decisão;",
          "possibilidade de revisão.",
        ],
      },
      {
        heading: "Governança proporcional",
        paragraphs: [
          "Nem todo projeto precisa de burocracia pesada. O necessário é manter rastreabilidade suficiente para explicar o que mudou e por quê.",
        ],
      },
    ],
  },
  {
    slug: "kanban-lista-ou-tabela",
    title: "Kanban, lista ou tabela? A visualização certa para cada decisão",
    excerpt:
      "As visualizações não disputam autoridade: todas apresentam recortes do mesmo estado operacional.",
    category: "Produto",
    publishedAt: "2026-07-04",
    readingMinutes: 4,
    coverPattern: "grid",
    coverLabel: "PLANO / LISTA / KANBAN",
    sections: [
      {
        heading: "Uma fonte, múltiplas perguntas",
        paragraphs: [
          "O plano explica sequência e dependências. A lista favorece leitura linear. A tabela facilita comparação. O Kanban evidencia fluxo e bloqueios.",
        ],
      },
      {
        heading: "Sem duplicar cartões",
        paragraphs: [
          "Trocar de visão não cria uma nova tarefa. Cada superfície projeta o mesmo contrato de domínio, mantendo status, responsável e evidência sincronizados.",
        ],
      },
      {
        heading: "Hoje continua dominante",
        paragraphs: [
          "As visões analíticas existem para apoiar decisões, mas a execução diária volta sempre à próxima ação clara.",
        ],
      },
    ],
  },
  {
    slug: "lancamento-com-rollback-real",
    title: "Como preparar um lançamento com rollback real",
    excerpt:
      "Preview, migração, evidência e aprovação humana formam uma única disciplina de lançamento.",
    category: "Governança",
    publishedAt: "2026-06-30",
    readingMinutes: 7,
    coverPattern: "steps",
    coverLabel: "PREVIEW → ACEITE → PROD",
    sections: [
      {
        heading: "Produção não é ambiente de descoberta",
        paragraphs: [
          "O fluxo começa em uma branch, passa por pull request e gera um Preview isolado. Build verde é necessário, mas não comprova login, dados ou autorização.",
        ],
      },
      {
        heading: "Banco exige outro nível de cuidado",
        paragraphs: [
          "Migrações devem ser revisadas, ensaiadas e aplicadas primeiro em Preview. Testes com dois workspaces comprovam o isolamento antes da promoção.",
        ],
        bullets: [
          "backup confirmado;",
          "dry-run revisado;",
          "smoke test documentado;",
          "deployment anterior conhecido.",
        ],
      },
      {
        heading: "Rollback é parte da entrega",
        paragraphs: [
          "A equipe precisa saber qual versão promover, qual commit reverter e quando restaurar dados. Sem esse caminho, a aprovação de lançamento está incompleta.",
        ],
        callout:
          "A pergunta não é apenas “podemos publicar?”, mas “sabemos voltar com segurança?”.",
      },
    ],
  },
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function relatedBlogPosts(post: BlogPost, limit = 3): BlogPost[] {
  const sameCategory = blogPosts.filter(
    (candidate) => candidate.slug !== post.slug && candidate.category === post.category,
  );
  const remaining = blogPosts.filter(
    (candidate) =>
      candidate.slug !== post.slug &&
      !sameCategory.some((related) => related.slug === candidate.slug),
  );
  return [...sameCategory, ...remaining].slice(0, limit);
}

export function postToMarkdown(post: BlogPost): string {
  const lines = [
    `# ${post.title}`,
    "",
    post.excerpt,
    "",
    `Categoria: ${post.category}`,
    `Publicado em: ${post.publishedAt}`,
    `Leitura: ${post.readingMinutes} min`,
    "",
  ];

  for (const section of post.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const paragraph of section.paragraphs) lines.push(paragraph, "");
    if (section.bullets) {
      for (const bullet of section.bullets) lines.push(`- ${bullet}`);
      lines.push("");
    }
    if (section.callout) lines.push(`> ${section.callout}`, "");
  }

  return lines.join("\n").trim();
}
