import crypto from "node:crypto";
import type {
  EditorialAdapterEvidence,
  EditorialAdapterFindings,
  EditorialAdapterName,
  EditorialPublication,
} from "./types.js";

export interface EditorialAdapterInput {
  publication: EditorialPublication;
  content_hash: string;
}

export interface EditorialAdapterRunner {
  name: EditorialAdapterName;
  version: string;
  run(input: EditorialAdapterInput): Promise<EditorialAdapterFindings>;
}

export type EditorialAdapterRegistry = Record<EditorialAdapterName, EditorialAdapterRunner>;

const emptyFindings = (): EditorialAdapterFindings => ({
  errors: [],
  warnings: [],
  recommendations: [],
});

export function editorialContentHash(publication: EditorialPublication): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      version: publication.version,
      briefing: publication.briefing,
      content: {
        slug: publication.content.slug,
        excerpt: publication.content.excerpt,
        markdown: publication.content.markdown,
      },
    }))
    .digest("hex");
}

export function createInitialAdapterEvidence(
  adapter: EditorialAdapterName,
  publicationVersion: number,
): EditorialAdapterEvidence {
  return {
    adapter,
    status: "NOT_RUN",
    adapter_version: null,
    publication_version: publicationVersion,
    content_hash: null,
    started_at: null,
    completed_at: null,
    findings: emptyFindings(),
    output_reference: null,
    actor: null,
    skip_reason: null,
  };
}

export function hasCurrentAppliedEvidence(
  evidence: EditorialAdapterEvidence,
  publication: EditorialPublication,
  contentHash = editorialContentHash(publication),
): boolean {
  return evidence.status === "APPLIED"
    && evidence.adapter_version !== null
    && evidence.publication_version === publication.version
    && evidence.content_hash === contentHash
    && evidence.started_at !== null
    && evidence.completed_at !== null
    && evidence.output_reference !== null
    && evidence.actor !== null;
}

function markdownParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter((block) => block.length > 0 && !/^(?:#{1,6}\s|[-*+]\s|\d+\.\s)/.test(block));
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const deskgo: EditorialAdapterRunner = {
  name: "deskgo",
  version: "1.0.0",
  async run({ publication }) {
    const findings = emptyFindings();
    const markdown = publication.content.markdown;
    const h1Count = markdown.match(/^#\s+.+$/gm)?.length ?? 0;
    const paragraphs = markdownParagraphs(markdown);

    if (publication.briefing.channel !== "EXECUTA_JOURNAL") {
      findings.errors.push("O canal editorial deve ser EXECUTA_JOURNAL.");
    }
    if (publication.briefing.language !== "pt-BR") {
      findings.errors.push("O perfil DeskGo desta versão exige conteúdo em pt-BR.");
    }
    if (h1Count !== 1) {
      findings.errors.push("A hierarquia editorial exige exatamente um título H1.");
    }
    if (paragraphs.some((paragraph) => words(paragraph) > 120)) {
      findings.warnings.push("Há parágrafos com mais de 120 palavras; reduza a densidade cognitiva.");
    }
    if (publication.content.excerpt.length > 220) {
      findings.warnings.push("O resumo público ultrapassa 220 caracteres.");
    }
    if (!/^##\s+.+/m.test(markdown)) {
      findings.errors.push("A organização editorial exige ao menos uma seção H2.");
    }
    if (!/^(?:[-*+]\s|\d+\.\s)/m.test(markdown)) {
      findings.recommendations.push("Considere uma lista curta para facilitar a leitura por varredura.");
    }
    return findings;
  },
};

const frankwatching: EditorialAdapterRunner = {
  name: "frankwatching",
  version: "1.0.0",
  async run({ publication }) {
    const findings = emptyFindings();
    const markdown = publication.content.markdown;
    const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
    const paragraphs = markdownParagraphs(markdown);
    const introduction = paragraphs[0] ?? "";
    const lastSection = markdown.split(/^##\s+/m).at(-1) ?? "";
    const sentences = markdown
      .replace(/^#{1,6}\s+.+$/gm, "")
      .split(/[.!?](?:\s|$)/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (title.length < 20 || title.length > 90) {
      findings.warnings.push("O título deve ter entre 20 e 90 caracteres para ganhar clareza e força.");
    }
    if (words(introduction) < 18) {
      findings.warnings.push("A introdução está curta; explicite problema, audiência e benefício.");
    }
    if (sentences.some((sentence) => words(sentence) > 35)) {
      findings.warnings.push("Há frases com mais de 35 palavras; revise clareza e escaneabilidade.");
    }
    if (!/(conclus[aã]o|resultado|pr[oó]xima a[cç][aã]o|o que fazer)/i.test(lastSection)) {
      findings.recommendations.push("Finalize com conclusão ou próxima ação explícita.");
    }
    if (!/(confira|comece|aplique|faça|use|preencha|avalie|revise|decida|pr[oó]xima a[cç][aã]o)/i.test(lastSection)) {
      findings.recommendations.push("Inclua uma chamada para ação verificável na seção final.");
    }
    return findings;
  },
};

const ames: EditorialAdapterRunner = {
  name: "ames",
  version: "1.0.0",
  async run({ publication }) {
    const findings = emptyFindings();
    const markdown = publication.content.markdown;
    const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)];
    const h1Count = headings.filter((heading) => heading[1]?.length === 1).length;
    const h2Count = headings.filter((heading) => heading[1]?.length === 2).length;

    if (h1Count !== 1) findings.errors.push("O contrato multiformato exige exatamente um H1.");
    if (h2Count < 1) findings.errors.push("O contrato multiformato exige uma ou mais seções H2.");
    if (!publication.content.slug || !publication.content.excerpt) {
      findings.errors.push("Slug e resumo público são obrigatórios em todos os formatos de saída.");
    }
    if (!publication.id || publication.version < 1) {
      findings.errors.push("Identificador e versão são obrigatórios para rastreabilidade.");
    }
    if (/<[a-z][\s\S]*>/i.test(markdown)) {
      findings.warnings.push("HTML embutido pode não ser compatível com todos os formatos de saída.");
    }
    for (let index = 1; index < headings.length; index += 1) {
      const previousLevel = headings[index - 1]?.[1]?.length ?? 1;
      const currentLevel = headings[index]?.[1]?.length ?? 1;
      if (currentLevel > previousLevel + 1) {
        findings.warnings.push("A hierarquia contém salto de nível entre títulos.");
        break;
      }
    }
    if (!/\[[^\]]+\]\([^)]+\)/.test(markdown)) {
      findings.recommendations.push("Adicione referências quando houver evidências ou fontes externas.");
    }
    return findings;
  },
};

export const editorialAdapterRegistry: EditorialAdapterRegistry = {
  deskgo,
  frankwatching,
  ames,
};
