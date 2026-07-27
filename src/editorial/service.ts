import crypto from "node:crypto";
import { DomainError } from "../domain/errors.js";
import { validateEditorialPublication } from "./schema.js";
import { assertEditorialTransition } from "./state-machine.js";
import type { EditorialRepository } from "./store.js";
import type {
  EditorialEvent,
  EditorialPublication,
  EditorialPublicationSummary,
  EditorialStatus,
} from "./types.js";

interface CreatePublicationInput {
  title?: string;
  summary?: string;
  audience?: string;
  objective?: string;
  author?: string;
  source_text?: string;
  keywords?: string[];
  slug?: string;
  actor?: string;
}

interface ContentUpdateInput {
  markdown?: string;
  excerpt?: string;
  slug?: string;
  actor?: string;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || `publicacao-${Date.now()}`;
}

function readingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
}

function event(
  type: EditorialEvent["type"],
  actor: string,
  detail: string,
  status?: { from: EditorialStatus; to: EditorialStatus },
): EditorialEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    type,
    at: new Date().toISOString(),
    actor,
    detail,
    ...(status ? { from_status: status.from, to_status: status.to } : {}),
  };
}

function summary(publication: EditorialPublication): EditorialPublicationSummary {
  return {
    id: publication.id,
    title: publication.briefing.title,
    slug: publication.content.slug,
    status: publication.status,
    version: publication.version,
    preview_url: publication.preview.url,
    publication_url: publication.publication.url,
    updated_at: publication.updated_at,
  };
}

export class EditorialService {
  constructor(private readonly store: EditorialRepository) {}

  validate(input: unknown) {
    return validateEditorialPublication(input);
  }

  async listPublications(): Promise<EditorialPublicationSummary[]> {
    const publications: EditorialPublicationSummary[] = [];
    for (const id of await this.store.listPublicationIds()) {
      const publication = await this.store.getPublication(id);
      if (publication) publications.push(summary(publication));
    }
    return publications.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }

  async createPublication(input: CreatePublicationInput): Promise<EditorialPublication> {
    const title = input.title?.trim();
    const summaryText = input.summary?.trim();
    const audience = input.audience?.trim();
    const objective = input.objective?.trim();
    const author = input.author?.trim();
    const sourceText = input.source_text?.trim();
    if (!title || !summaryText || !audience || !objective || !author || !sourceText) {
      throw new DomainError(
        "INVALID_INPUT",
        "O briefing editorial está incompleto.",
        "Informe title, summary, audience, objective, author e source_text.",
        422,
      );
    }

    const now = new Date().toISOString();
    const actor = input.actor?.trim() || author;
    const publication: EditorialPublication = {
      id: `PUB-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`,
      version: 1,
      status: "DRAFT",
      briefing: {
        title,
        summary: summaryText,
        audience,
        objective,
        author,
        source_text: sourceText,
        keywords: (input.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean),
        channel: "EXECUTA_JOURNAL",
        language: "pt-BR",
      },
      content: {
        slug: slugify(input.slug?.trim() || title),
        excerpt: summaryText.slice(0, 240),
        markdown: sourceText,
        reading_time_minutes: readingTime(sourceText),
        generated_at: null,
      },
      quality: {
        valid: false,
        score: null,
        errors: [],
        warnings: ["Desk&Go, Frankwatching e AMES ainda não foram aplicados."],
        checked_at: null,
        adapters: { deskgo: "PENDING", frankwatching: "PENDING", ames: "PENDING" },
      },
      github: { branch: null, pull_request_number: null, pull_request_url: null, commit_sha: null },
      preview: { deployment_id: null, url: null, created_at: null },
      approval: { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null },
      publication: { url: null, published_at: null, commit_sha: null },
      qr: { create_url: null, preview_url: null, approve_url: null, analytics_url: null },
      events: [event("CREATED", actor, "Briefing editorial criado.")],
      created_at: now,
      updated_at: now,
    };

    const validation = validateEditorialPublication(publication);
    if (!validation.valid) {
      throw new DomainError("INVALID_INPUT", "A publicação não atende ao contrato editorial.", validation.errors.join(" "), 422);
    }
    await this.store.savePublication(publication);
    return publication;
  }

  async getPublication(id: string): Promise<EditorialPublication> {
    return this.requirePublication(id);
  }

  async updateContent(id: string, input: ContentUpdateInput): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status)) {
      throw new DomainError(
        "CONTENT_LOCKED",
        `O conteúdo não pode ser alterado em ${publication.status}.`,
        "Retorne a publicação para revisão antes de editar.",
        409,
      );
    }

    const markdown = input.markdown?.trim() || publication.content.markdown;
    const excerpt = input.excerpt?.trim() || publication.content.excerpt;
    const previous = publication.status;
    publication.version += 1;
    publication.status = "DRAFT";
    publication.content = {
      ...publication.content,
      markdown,
      excerpt,
      slug: slugify(input.slug?.trim() || publication.content.slug),
      reading_time_minutes: readingTime(markdown),
      generated_at: new Date().toISOString(),
    };
    publication.quality = {
      valid: false,
      score: null,
      errors: [],
      warnings: ["Conteúdo alterado; execute novamente o gate editorial."],
      checked_at: null,
      adapters: { deskgo: "PENDING", frankwatching: "PENDING", ames: "PENDING" },
    };
    publication.github = { branch: null, pull_request_number: null, pull_request_url: null, commit_sha: null };
    publication.preview = { deployment_id: null, url: null, created_at: null };
    publication.approval = { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null };
    publication.publication = { url: null, published_at: null, commit_sha: null };
    publication.updated_at = new Date().toISOString();
    publication.events.push(event("CONTENT_UPDATED", input.actor?.trim() || publication.briefing.author, `Conteúdo atualizado para a versão ${publication.version}.`));
    if (previous !== "DRAFT") {
      publication.events.push(event("STATUS_CHANGED", input.actor?.trim() || publication.briefing.author, "Publicação devolvida para rascunho após alteração.", { from: previous, to: "DRAFT" }));
    }
    await this.store.savePublication(publication);
    return publication;
  }

  async runQualityGate(id: string, actor: string): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status)) {
      throw new DomainError("INVALID_TRANSITION", `Não é possível validar a publicação em ${publication.status}.`, "Edite ou retorne a publicação para rascunho.", 409);
    }

    this.changeStatus(publication, "VALIDATING", actor, "Gate editorial iniciado.");
    const errors: string[] = [];
    const warnings: string[] = [];
    if (publication.content.markdown.trim().length < 120) errors.push("O artigo precisa ter ao menos 120 caracteres.");
    if (!/^#\s+.+/m.test(publication.content.markdown)) warnings.push("O conteúdo ainda não possui um título Markdown H1.");
    if (!/^##\s+.+/m.test(publication.content.markdown)) warnings.push("O conteúdo ainda não possui seções H2.");
    for (const [adapter, status] of Object.entries(publication.quality.adapters)) {
      if (status !== "APPLIED") warnings.push(`Adapter ${adapter} ainda está ${status}.`);
    }

    const contract = validateEditorialPublication(publication);
    errors.push(...contract.errors);
    warnings.push(...contract.warnings);
    publication.quality = {
      ...publication.quality,
      valid: errors.length === 0,
      score: Math.max(0, 100 - errors.length * 30 - warnings.length * 5),
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      checked_at: new Date().toISOString(),
    };

    const target: EditorialStatus = publication.quality.valid ? "READY_FOR_PREVIEW" : "VALIDATION_FAILED";
    this.changeStatus(publication, target, actor, publication.quality.valid ? "Gate editorial aprovado." : "Gate editorial reprovado.");
    await this.store.savePublication(publication);
    return publication;
  }

  async recordAdapters(
    id: string,
    adapters: Partial<EditorialPublication["quality"]["adapters"]>,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status)) {
      throw new DomainError("QUALITY_LOCKED", "Os adapters não podem ser alterados neste estado.", "Retorne para rascunho antes de reaplicar critérios editoriais.", 409);
    }
    publication.quality.adapters = { ...publication.quality.adapters, ...adapters };
    publication.updated_at = new Date().toISOString();
    publication.events.push(event("CONTENT_UPDATED", actor, "Estado dos adapters editoriais atualizado."));
    await this.store.savePublication(publication);
    return publication;
  }

  async startPreview(id: string, input: { branch: string; commit_sha: string; pull_request_number?: number; pull_request_url?: string; actor: string }): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    publication.github = {
      branch: input.branch.trim(),
      commit_sha: input.commit_sha.trim(),
      pull_request_number: input.pull_request_number ?? null,
      pull_request_url: input.pull_request_url?.trim() || null,
    };
    this.changeStatus(publication, "PREVIEW_BUILDING", input.actor, "Branch e commit do preview registrados.");
    await this.store.savePublication(publication);
    return publication;
  }

  async attachPreview(id: string, input: { url: string; deployment_id?: string; actor: string }): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (publication.status === "PREVIEW_FAILED") this.changeStatus(publication, "PREVIEW_BUILDING", input.actor, "Nova tentativa de preview iniciada.");
    if (publication.status !== "PREVIEW_BUILDING") {
      throw new DomainError("INVALID_TRANSITION", `O preview não pode ser anexado em ${publication.status}.`, "Inicie o build do preview primeiro.", 409);
    }
    publication.preview = { url: input.url.trim(), deployment_id: input.deployment_id?.trim() || null, created_at: new Date().toISOString() };
    publication.events.push(event("PREVIEW_ATTACHED", input.actor, `Preview registrado em ${publication.preview.url}.`));
    this.changeStatus(publication, "PREVIEW_READY", input.actor, "Preview disponível para revisão.");
    await this.store.savePublication(publication);
    return publication;
  }

  async startReview(id: string, actor: string): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    this.changeStatus(publication, "IN_REVIEW", actor, "Revisão humana iniciada.");
    await this.store.savePublication(publication);
    return publication;
  }

  async review(id: string, input: { decision: "APPROVED" | "CHANGES_REQUESTED"; reviewer: string; note?: string }): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (publication.status !== "IN_REVIEW") {
      throw new DomainError("INVALID_TRANSITION", `A decisão não pode ser registrada em ${publication.status}.`, "Inicie a revisão humana primeiro.", 409);
    }
    publication.approval = {
      decision: input.decision,
      reviewer: input.reviewer.trim(),
      note: input.note?.trim() || null,
      decided_at: new Date().toISOString(),
      approved_commit_sha: input.decision === "APPROVED" ? publication.github.commit_sha : null,
    };
    publication.events.push(event("REVIEW_RECORDED", input.reviewer, `Decisão humana: ${input.decision}.`));
    this.changeStatus(publication, input.decision, input.reviewer, input.decision === "APPROVED" ? "Commit aprovado para publicação." : "Alterações solicitadas.");
    await this.store.savePublication(publication);
    return publication;
  }

  async startPublishing(id: string, actor: string): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    this.changeStatus(publication, "PUBLISHING", actor, "Publicação autorizada e iniciada.");
    await this.store.savePublication(publication);
    return publication;
  }

  async markPublished(id: string, input: { url: string; commit_sha: string; actor: string }): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (publication.status !== "PUBLISHING") {
      throw new DomainError("INVALID_TRANSITION", `A publicação não pode ser concluída em ${publication.status}.`, "Inicie a publicação após aprovação humana.", 409);
    }
    publication.publication = { url: input.url.trim(), commit_sha: input.commit_sha.trim(), published_at: new Date().toISOString() };
    this.changeStatus(publication, "PUBLISHED", input.actor, "Artigo publicado no EXECUTA Journal.");
    publication.events.push(event("PUBLISHED", input.actor, `Publicação confirmada em ${publication.publication.url}.`));
    await this.store.savePublication(publication);
    return publication;
  }

  async exportPackage(id: string): Promise<EditorialPublication> {
    return this.requirePublication(id);
  }

  async deletePublication(id: string): Promise<{ publication_id: string; deleted: true }> {
    const deleted = await this.store.deletePublication(id);
    if (!deleted) throw new DomainError("NOT_FOUND", `A publicação ${id} não existe.`, "Atualize a lista editorial.", 404);
    return { publication_id: id, deleted: true };
  }

  private changeStatus(publication: EditorialPublication, target: EditorialStatus, actor: string, detail: string): void {
    const previous = publication.status;
    assertEditorialTransition(publication, target);
    publication.status = target;
    publication.updated_at = new Date().toISOString();
    publication.events.push(event("STATUS_CHANGED", actor, detail, { from: previous, to: target }));
  }

  private async requirePublication(id: string): Promise<EditorialPublication> {
    const publication = await this.store.getPublication(id);
    if (!publication) throw new DomainError("NOT_FOUND", `A publicação ${id} não existe.`, "Atualize a lista editorial.", 404);
    return structuredClone(publication);
  }
}
