import crypto from "node:crypto";
import { DomainError } from "../domain/errors.js";
import {
  createInitialAdapterEvidence,
  editorialAdapterRegistry,
  editorialContentHash,
  hasCurrentAppliedEvidence,
  type EditorialAdapterRegistry,
} from "./adapters.js";
import { normalizeEditorialPublication } from "./compatibility.js";
import { validateEditorialPublication } from "./schema.js";
import { assertEditorialTransition, assertReadyForPreviewEvidence } from "./state-machine.js";
import type { EditorialRepository } from "./store.js";
import type {
  EditorialAdapterEvidence,
  EditorialAdapterName,
  EditorialEvent,
  EditorialPublication,
  EditorialPublicationSummary,
  EditorialStatus,
} from "./types.js";
import { EDITORIAL_ADAPTERS } from "./types.js";

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

function timestampAfter(value: string): string {
  return new Date(Math.max(Date.now(), Date.parse(value) + 1)).toISOString();
}

function minimumStructureErrors(publication: EditorialPublication): string[] {
  const errors: string[] = [];
  if (publication.content.markdown.trim().length < 120) {
    errors.push("O artigo precisa ter ao menos 120 caracteres.");
  }
  if (!/^#\s+.+/m.test(publication.content.markdown)) {
    errors.push("O conteúdo precisa de um título Markdown H1.");
  }
  if (!/^##\s+.+/m.test(publication.content.markdown)) {
    errors.push("O conteúdo precisa de uma ou mais seções H2.");
  }
  if (
    !publication.briefing.title.trim()
    || !publication.briefing.summary.trim()
    || !publication.briefing.audience.trim()
    || !publication.briefing.objective.trim()
    || !publication.briefing.author.trim()
  ) {
    errors.push("O briefing editorial obrigatório está incompleto.");
  }
  return errors;
}

function staleEvidence(
  evidence: EditorialAdapterEvidence,
  publicationVersion: number,
): EditorialAdapterEvidence {
  if (evidence.status === "NOT_RUN" && !evidence.content_hash) {
    return createInitialAdapterEvidence(evidence.adapter, publicationVersion);
  }
  return {
    ...evidence,
    status: "STALE",
    findings: {
      ...evidence.findings,
      warnings: [
        ...new Set([
          ...evidence.findings.warnings,
          "O conteúdo mudou depois desta execução.",
        ]),
      ],
    },
  };
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
  constructor(
    private readonly store: EditorialRepository,
    private readonly adapterRegistry: EditorialAdapterRegistry = editorialAdapterRegistry,
  ) {}

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
        updated_at: now,
      },
      quality: {
        valid: false,
        gate_result: "NOT_RUN",
        score: null,
        errors: [],
        warnings: ["DeskGo, Frankwatching e AMES ainda não foram executados."],
        checked_at: null,
        content_hash: null,
        adapters: {
          deskgo: createInitialAdapterEvidence("deskgo", 1),
          frankwatching: createInitialAdapterEvidence("frankwatching", 1),
          ames: createInitialAdapterEvidence("ames", 1),
        },
      },
      github: {
        branch: null,
        pull_request_number: null,
        pull_request_url: null,
        commit_sha: null,
        publication_version: null,
        content_hash: null,
      },
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
    if (![
      "DRAFT",
      "CONTENT_READY",
      "ADAPTERS_APPLIED",
      "ADAPTER_FAILED",
      "VALIDATION_FAILED",
      "CHANGES_REQUESTED",
    ].includes(publication.status)) {
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
    const contentUpdatedAt = timestampAfter(publication.content.updated_at);
    publication.content = {
      ...publication.content,
      markdown,
      excerpt,
      slug: slugify(input.slug?.trim() || publication.content.slug),
      reading_time_minutes: readingTime(markdown),
      generated_at: contentUpdatedAt,
      updated_at: contentUpdatedAt,
    };
    publication.quality = {
      valid: false,
      gate_result: "NOT_RUN",
      score: null,
      errors: [],
      warnings: ["Conteúdo alterado; execute novamente os adapters e o gate editorial."],
      checked_at: null,
      content_hash: null,
      adapters: {
        deskgo: staleEvidence(publication.quality.adapters.deskgo, publication.version),
        frankwatching: staleEvidence(publication.quality.adapters.frankwatching, publication.version),
        ames: staleEvidence(publication.quality.adapters.ames, publication.version),
      },
    };
    publication.github = {
      branch: null,
      pull_request_number: null,
      pull_request_url: null,
      commit_sha: null,
      publication_version: null,
      content_hash: null,
    };
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
    if (publication.status !== "ADAPTERS_APPLIED") {
      throw new DomainError(
        "ADAPTERS_REQUIRED",
        `Não é possível executar o gate final em ${publication.status}.`,
        "Execute DeskGo, Frankwatching e AMES antes da validação final.",
        409,
      );
    }

    this.changeStatus(publication, "VALIDATING", actor, "Gate editorial iniciado.");
    const contentHash = editorialContentHash(publication);
    const errors = minimumStructureErrors(publication);
    const warnings: string[] = [];
    let recommendationCount = 0;
    for (const adapter of EDITORIAL_ADAPTERS) {
      const evidence = publication.quality.adapters[adapter];
      if (!hasCurrentAppliedEvidence(evidence, publication, contentHash)) {
        errors.push(`Adapter obrigatório ${adapter} não possui evidência APPLIED para esta versão.`);
        continue;
      }
      errors.push(...evidence.findings.errors.map((message) => `${adapter}: ${message}`));
      warnings.push(...evidence.findings.warnings.map((message) => `${adapter}: ${message}`));
      recommendationCount += evidence.findings.recommendations.length;
    }

    const contract = validateEditorialPublication(publication);
    errors.push(...contract.errors);
    warnings.push(...contract.warnings);
    const checkedAt = timestampAfter(publication.content.updated_at);
    const uniqueErrors = [...new Set(errors)];
    const uniqueWarnings = [...new Set(warnings)];
    publication.quality = {
      ...publication.quality,
      valid: uniqueErrors.length === 0,
      gate_result: uniqueErrors.length === 0 ? "PASSED" : "FAILED",
      score: Math.max(0, 100 - uniqueWarnings.length * 5 - recommendationCount * 2),
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      checked_at: checkedAt,
      content_hash: contentHash,
    };

    const target: EditorialStatus = publication.quality.valid ? "READY_FOR_PREVIEW" : "VALIDATION_FAILED";
    publication.events.push(event(
      "GATE_COMPLETED",
      actor,
      publication.quality.valid
        ? `Gate técnico aprovado; pontuação editorial ${publication.quality.score}/100.`
        : `Gate técnico reprovado; pontuação editorial ${publication.quality.score}/100.`,
    ));
    this.changeStatus(publication, target, actor, publication.quality.valid ? "Gate editorial aprovado." : "Gate editorial reprovado.");
    await this.store.savePublication(publication);
    return publication;
  }

  async runAdapters(
    id: string,
    actor: string,
  ): Promise<EditorialPublication> {
    let publication = await this.requirePublication(id);
    for (const adapter of EDITORIAL_ADAPTERS) {
      publication = await this.runAdapter(id, adapter, actor);
    }
    return publication;
  }

  async runAdapter(
    id: string,
    adapter: EditorialAdapterName,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!EDITORIAL_ADAPTERS.includes(adapter)) {
      throw new DomainError("INVALID_ADAPTER", `Adapter editorial inválido: ${adapter}.`, "Use deskgo, frankwatching ou ames.", 422);
    }
    if (![
      "DRAFT",
      "CONTENT_READY",
      "ENRICHING",
      "ADAPTERS_APPLIED",
      "ADAPTER_FAILED",
      "VALIDATION_FAILED",
      "CHANGES_REQUESTED",
    ].includes(publication.status)) {
      throw new DomainError(
        "QUALITY_LOCKED",
        `Os adapters não podem ser executados em ${publication.status}.`,
        "Edite ou devolva a publicação para rascunho antes de reaplicar critérios editoriais.",
        409,
      );
    }

    const structureErrors = minimumStructureErrors(publication);
    if (structureErrors.length > 0) {
      throw new DomainError(
        "CONTENT_NOT_READY",
        "A estrutura mínima precisa ser corrigida antes dos adapters.",
        structureErrors.join(" "),
        409,
      );
    }

    if (["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status)) {
      this.changeStatus(publication, "CONTENT_READY", actor, "Estrutura mínima confirmada.");
    }
    if (publication.status !== "ENRICHING") {
      this.changeStatus(publication, "ENRICHING", actor, `Execução do adapter ${adapter} iniciada.`);
    }

    const runner = this.adapterRegistry[adapter];
    const contentHash = editorialContentHash(publication);
    const startedAt = timestampAfter(publication.content.updated_at);
    publication.quality.valid = false;
    publication.quality.gate_result = "NOT_RUN";
    publication.quality.checked_at = null;
    publication.quality.content_hash = null;
    publication.quality.adapters[adapter] = {
      adapter,
      status: "RUNNING",
      adapter_version: runner.version,
      publication_version: publication.version,
      content_hash: contentHash,
      started_at: startedAt,
      completed_at: null,
      findings: { errors: [], warnings: [], recommendations: [] },
      output_reference: null,
      actor,
      skip_reason: null,
    };
    publication.updated_at = startedAt;
    publication.events.push(event("ADAPTER_STARTED", actor, `${adapter} ${runner.version} iniciado.`));
    await this.store.savePublication(publication);

    try {
      const findings = await runner.run({ publication: structuredClone(publication), content_hash: contentHash });
      publication.quality.adapters[adapter] = {
        ...publication.quality.adapters[adapter],
        status: "APPLIED",
        completed_at: timestampAfter(startedAt),
        findings: {
          errors: [...new Set(findings.errors)],
          warnings: [...new Set(findings.warnings)],
          recommendations: [...new Set(findings.recommendations)],
        },
        output_reference: `editorial://${publication.id}/v${publication.version}/adapters/${adapter}/${contentHash}`,
      };
      publication.events.push(event(
        "ADAPTER_COMPLETED",
        actor,
        `${adapter} aplicado com ${findings.errors.length} erro(s), ${findings.warnings.length} aviso(s) e ${findings.recommendations.length} recomendação(ões).`,
      ));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha desconhecida do adapter.";
      publication.quality.adapters[adapter] = {
        ...publication.quality.adapters[adapter],
        status: "FAILED",
        completed_at: timestampAfter(startedAt),
        findings: { errors: [message], warnings: [], recommendations: [] },
      };
      publication.events.push(event("ADAPTER_FAILED", actor, `${adapter} falhou: ${message}`));
    }

    const allApplied = EDITORIAL_ADAPTERS.every((name) =>
      hasCurrentAppliedEvidence(publication.quality.adapters[name], publication, contentHash)
    );
    const anyFailed = EDITORIAL_ADAPTERS.some((name) =>
      publication.quality.adapters[name].status === "FAILED"
    );
    if (allApplied) {
      this.changeStatus(publication, "ADAPTERS_APPLIED", actor, "Todos os adapters obrigatórios possuem evidência válida.");
    } else if (anyFailed && publication.status === "ENRICHING") {
      this.changeStatus(publication, "ADAPTER_FAILED", actor, "Um ou mais adapters falharam.");
    }
    publication.updated_at = timestampAfter(publication.updated_at);
    await this.store.savePublication(publication);
    return publication;
  }

  async startPreview(id: string, input: {
    branch: string;
    commit_sha: string;
    pull_request_number?: number;
    pull_request_url?: string;
    publication_version?: number;
    content_hash?: string;
    actor: string;
  }): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    assertReadyForPreviewEvidence(publication);
    const branch = input.branch.trim();
    const commitSha = input.commit_sha.trim();
    const contentHash = editorialContentHash(publication);
    if (!branch || !/^[0-9a-f]{40}$/i.test(commitSha)) {
      throw new DomainError("INVALID_GITHUB_EVIDENCE", "Branch e commit SHA-1 completo são obrigatórios.", "Registre a branch e os 40 caracteres hexadecimais do commit.", 422);
    }
    if (
      (input.publication_version !== undefined && input.publication_version !== publication.version)
      || (input.content_hash !== undefined && input.content_hash !== contentHash)
    ) {
      throw new DomainError(
        "GITHUB_CONTENT_MISMATCH",
        "A versão ou o hash informado não corresponde ao conteúdo aprovado.",
        "Gere novamente o artefato GitHub a partir da versão editorial atual.",
        409,
      );
    }
    publication.github = {
      branch,
      commit_sha: commitSha,
      pull_request_number: input.pull_request_number ?? null,
      pull_request_url: input.pull_request_url?.trim() || null,
      publication_version: publication.version,
      content_hash: contentHash,
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
    const previewUrl = input.url.trim();
    const deploymentId = input.deployment_id?.trim();
    if (!/^https:\/\//i.test(previewUrl) || !deploymentId) {
      throw new DomainError(
        "INVALID_PREVIEW_EVIDENCE",
        "URL HTTPS imutável e deployment_id são obrigatórios.",
        "Registre a URL do Preview e o identificador dpl_… da Vercel.",
        422,
      );
    }
    publication.preview = { url: previewUrl, deployment_id: deploymentId, created_at: new Date().toISOString() };
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
    return normalizeEditorialPublication(structuredClone(publication));
  }
}
