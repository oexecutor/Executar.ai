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
import {
  UnavailableEditorialArtifactPublisher,
  UnavailableEditorialPreviewResolver,
  type EditorialArtifactResult,
  type EditorialArtifactPublisher,
  type EditorialPreviewResolution,
  type EditorialPreviewResolver,
} from "./delivery.js";
import {
  createEditorialQrToken,
  emptyEditorialQrState,
  qrAccessPolicy,
  qrStateFromRegistrations,
  UnavailableEditorialQrRepository,
  type EditorialQrRegistration,
  type EditorialQrRepository,
} from "./qr.js";
import { validateEditorialPublication } from "./schema.js";
import {
  assertEditorialTransition,
  assertGitHubArtifactEvidence,
  assertReadyForPreviewEvidence,
} from "./state-machine.js";
import type { EditorialRepository } from "./store.js";
import type {
  EditorialAdapterEvidence,
  EditorialAdapterName,
  EditorialEvent,
  EditorialPublication,
  EditorialPublicationSummary,
  EditorialStatus,
} from "./types.js";
import { EDITORIAL_ADAPTERS, EDITORIAL_QR_ACTIONS } from "./types.js";

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
    private readonly artifactPublisher: EditorialArtifactPublisher = new UnavailableEditorialArtifactPublisher(),
    private readonly previewResolver: EditorialPreviewResolver = new UnavailableEditorialPreviewResolver(),
    private readonly qrRepository: EditorialQrRepository = new UnavailableEditorialQrRepository(),
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
        warnings: ["As três regras internas de qualidade ainda não foram executadas."],
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
        artifact_contract_version: null,
        artifact_paths: [],
        created_at: null,
      },
      preview: { deployment_id: null, url: null, created_at: null, commit_sha: null },
      approval: { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null },
      publication: { url: null, published_at: null, commit_sha: null },
      qr: emptyEditorialQrState(),
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
      warnings: ["Conteúdo alterado; execute novamente as regras internas e o gate da E1."],
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
      artifact_contract_version: null,
      artifact_paths: [],
      created_at: null,
    };
    publication.preview = { deployment_id: null, url: null, created_at: null, commit_sha: null };
    publication.approval = { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null };
    publication.publication = { url: null, published_at: null, commit_sha: null };
    publication.qr = emptyEditorialQrState();
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
        `Não é possível concluir o gate interno da E1 em ${publication.status}.`,
        "Execute as três regras internas de qualidade antes da validação final.",
        409,
      );
    }

    this.changeStatus(publication, "VALIDATING", actor, "Gate interno da E1 iniciado.");
    const contentHash = editorialContentHash(publication);
    const errors = minimumStructureErrors(publication);
    const warnings: string[] = [];
    let recommendationCount = 0;
    for (const adapter of EDITORIAL_ADAPTERS) {
      const evidence = publication.quality.adapters[adapter];
      if (!hasCurrentAppliedEvidence(evidence, publication, contentHash)) {
        errors.push(`Regra interna obrigatória ${adapter} não possui evidência APPLIED para esta versão.`);
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
        ? `Gate interno da E1 aprovado; pontuação editorial ${publication.quality.score}/100.`
        : `Gate interno da E1 reprovado; pontuação editorial ${publication.quality.score}/100.`,
    ));
    this.changeStatus(publication, target, actor, publication.quality.valid ? "Gate interno da E1 aprovado." : "Gate interno da E1 reprovado.");
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

  async runInternalRules(
    id: string,
    actor: string,
  ): Promise<EditorialPublication> {
    return this.runAdapters(id, actor);
  }

  async runInternalRule(
    id: string,
    rule: EditorialAdapterName,
    actor: string,
  ): Promise<EditorialPublication> {
    return this.runAdapter(id, rule, actor);
  }

  async runAdapter(
    id: string,
    adapter: EditorialAdapterName,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!EDITORIAL_ADAPTERS.includes(adapter)) {
      throw new DomainError("INVALID_ADAPTER", `Regra interna inválida: ${adapter}.`, "Use uma das três chaves de compatibilidade registradas.", 422);
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
        `As regras internas não podem ser executadas em ${publication.status}.`,
        "Edite ou devolva a publicação para rascunho antes de reaplicar as verificações de qualidade.",
        409,
      );
    }

    const structureErrors = minimumStructureErrors(publication);
    if (structureErrors.length > 0) {
      throw new DomainError(
        "CONTENT_NOT_READY",
        "A estrutura mínima precisa ser corrigida antes das regras internas.",
        structureErrors.join(" "),
        409,
      );
    }

    if (["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status)) {
      this.changeStatus(publication, "CONTENT_READY", actor, "Estrutura mínima confirmada.");
    }
    if (publication.status !== "ENRICHING") {
      this.changeStatus(publication, "ENRICHING", actor, `Execução da regra interna ${adapter} iniciada.`);
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
    publication.events.push(event("ADAPTER_STARTED", actor, `Regra interna ${adapter} ${runner.version} iniciada.`));
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
        output_reference: `internal-rule://${publication.id}/v${publication.version}/${adapter}/${contentHash}`,
      };
      publication.events.push(event(
        "ADAPTER_COMPLETED",
        actor,
        `Regra interna ${adapter} concluída com ${findings.errors.length} erro(s), ${findings.warnings.length} aviso(s) e ${findings.recommendations.length} recomendação(ões).`,
      ));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha desconhecida da regra interna.";
      publication.quality.adapters[adapter] = {
        ...publication.quality.adapters[adapter],
        status: "FAILED",
        completed_at: timestampAfter(startedAt),
        findings: { errors: [message], warnings: [], recommendations: [] },
      };
      publication.events.push(event("ADAPTER_FAILED", actor, `Regra interna ${adapter} falhou: ${message}`));
    }

    const allApplied = EDITORIAL_ADAPTERS.every((name) =>
      hasCurrentAppliedEvidence(publication.quality.adapters[name], publication, contentHash)
    );
    const anyFailed = EDITORIAL_ADAPTERS.some((name) =>
      publication.quality.adapters[name].status === "FAILED"
    );
    if (allApplied) {
      this.changeStatus(publication, "ADAPTERS_APPLIED", actor, "Todas as regras internas obrigatórias possuem evidência válida.");
    } else if (anyFailed && publication.status === "ENRICHING") {
      this.changeStatus(publication, "ADAPTER_FAILED", actor, "Uma ou mais regras internas falharam.");
    }
    publication.updated_at = timestampAfter(publication.updated_at);
    await this.store.savePublication(publication);
    return publication;
  }

  async createArtifact(
    id: string,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    this.assertArtifactCanStart(publication);
    const contentHash = editorialContentHash(publication);
    const artifact = await this.artifactPublisher.publish({
      publication: structuredClone(publication),
      content_hash: contentHash,
    });
    return this.recordArtifact(
      publication,
      artifact,
      actor,
      "E2 criou automaticamente",
    );
  }

  async registerVerifiedArtifact(
    id: string,
    artifact: EditorialArtifactResult,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    this.assertArtifactCanStart(publication);
    return this.recordArtifact(
      publication,
      artifact,
      actor,
      "E2 verificou e registrou a execução do conector:",
    );
  }

  private async recordArtifact(
    publication: EditorialPublication,
    artifact: EditorialArtifactResult,
    actor: string,
    provenance: string,
  ): Promise<EditorialPublication> {
    const contentHash = editorialContentHash(publication);
    const branch = artifact.branch.trim();
    const commitSha = artifact.commit_sha.trim();
    const pullRequestUrl = artifact.pull_request_url.trim();
    const artifactPaths = [...new Set(artifact.artifact_paths.map((path) => path.trim()).filter(Boolean))];
    if (!branch || !/^[0-9a-f]{40}$/i.test(commitSha)) {
      throw new DomainError(
        "E2_GITHUB_INVALID_RESPONSE",
        "A automação GitHub não retornou branch e commit válidos.",
        "Verifique a resposta do publisher e tente novamente sem registrar evidência manual.",
        502,
      );
    }
    if (
      !Number.isInteger(artifact.pull_request_number)
      || artifact.pull_request_number < 1
      || !/^https:\/\/github\.com\//i.test(pullRequestUrl)
      || artifactPaths.length < 2
    ) {
      throw new DomainError(
        "E2_GITHUB_INVALID_RESPONSE",
        "A automação GitHub retornou evidência incompleta do PR ou do pacote.",
        "O resultado deve conter número e URL do PR e os caminhos dos artefatos gravados.",
        502,
      );
    }
    publication.github = {
      branch,
      commit_sha: commitSha,
      pull_request_number: artifact.pull_request_number,
      pull_request_url: pullRequestUrl,
      publication_version: publication.version,
      content_hash: contentHash,
      artifact_contract_version: "1.0",
      artifact_paths: artifactPaths,
      created_at: artifact.created_at,
    };
    this.changeStatus(
      publication,
      "PREVIEW_BUILDING",
      actor,
      `${provenance} ${branch}, commit ${commitSha.slice(0, 8)} e PR #${artifact.pull_request_number}.`,
    );
    await this.store.savePublication(publication);
    return publication;
  }

  async syncPreview(
    id: string,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["PREVIEW_BUILDING", "PREVIEW_FAILED"].includes(publication.status)) {
      throw new DomainError("INVALID_TRANSITION", `O preview não pode ser anexado em ${publication.status}.`, "Inicie o build do preview primeiro.", 409);
    }
    if (!publication.github.branch || !publication.github.commit_sha) {
      throw new DomainError(
        "E2_GITHUB_EVIDENCE_REQUIRED",
        "A captura do Preview exige branch e commit criados pela E2.",
        "Crie novamente o pacote GitHub a partir da versão editorial aprovada.",
        409,
      );
    }
    assertGitHubArtifactEvidence(publication);

    const resolution = await this.previewResolver.resolve({
      branch: publication.github.branch,
      commit_sha: publication.github.commit_sha,
    });
    if (resolution.state === "PENDING") {
      if (publication.status === "PREVIEW_FAILED") {
        this.changeStatus(publication, "PREVIEW_BUILDING", actor, "Nova consulta automática do Vercel Preview iniciada.");
        await this.store.savePublication(publication);
      }
      return publication;
    }
    if (resolution.state === "FAILED") {
      if (publication.status === "PREVIEW_BUILDING") {
        this.changeStatus(publication, "PREVIEW_FAILED", actor, resolution.detail);
        await this.store.savePublication(publication);
      }
      return publication;
    }
    return this.recordReadyPreview(
      publication,
      resolution,
      actor,
      "capturado automaticamente",
    );
  }

  async registerVerifiedPreview(
    id: string,
    resolution: Extract<EditorialPreviewResolution, { state: "READY" }>,
    actor: string,
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["PREVIEW_BUILDING", "PREVIEW_FAILED"].includes(publication.status)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `O preview não pode ser registrado em ${publication.status}.`,
        "Inicie a E2 e verifique o artefato GitHub primeiro.",
        409,
      );
    }
    assertGitHubArtifactEvidence(publication);
    return this.recordReadyPreview(
      publication,
      resolution,
      actor,
      "verificado por evidência do deployment e registrado",
    );
  }

  private async recordReadyPreview(
    publication: EditorialPublication,
    resolution: Extract<EditorialPreviewResolution, { state: "READY" }>,
    actor: string,
    provenance: string,
  ): Promise<EditorialPublication> {
    if (
      resolution.commit_sha !== publication.github.commit_sha
      || !/^https:\/\//i.test(resolution.url)
      || !/^dpl_/.test(resolution.deployment_id)
    ) {
      throw new DomainError(
        "E2_PREVIEW_MISMATCH",
        "O deployment encontrado não corresponde ao commit editorial aprovado.",
        "A Vercel deve retornar URL imutável e deployment dpl_… para o mesmo SHA do PR.",
        409,
      );
    }
    if (publication.status === "PREVIEW_FAILED") {
      this.changeStatus(publication, "PREVIEW_BUILDING", actor, "Preview válido encontrado após nova consulta.");
    }
    publication.preview = {
      url: resolution.url,
      deployment_id: resolution.deployment_id,
      created_at: resolution.created_at,
      commit_sha: resolution.commit_sha,
    };
    publication.events.push(event(
      "PREVIEW_ATTACHED",
      actor,
      `Preview Vercel ${provenance} em ${publication.preview.url}.`,
    ));
    this.changeStatus(publication, "PREVIEW_READY", actor, "E2 concluída: Preview disponível para revisão humana.");
    await this.store.savePublication(publication);
    return publication;
  }

  /**
   * Compatibility command retained so callers receive a typed failure instead
   * of silently trusting client-supplied GitHub evidence.
   */
  async startPreview(_id: string, _input: {
    branch: string;
    commit_sha: string;
    pull_request_number?: number;
    pull_request_url?: string;
    publication_version?: number;
    content_hash?: string;
    actor: string;
  }): Promise<never> {
    throw new DomainError(
      "E2_AUTOMATION_REQUIRED",
      "Branch, commit e PR não podem mais ser registrados manualmente.",
      "Use a criação automática de artefato da E2.",
      410,
    );
  }

  /**
   * Compatibility command retained so callers receive a typed failure instead
   * of silently trusting a URL de Preview supplied by the client.
   */
  async attachPreview(_id: string, _input: {
    url: string;
    deployment_id?: string;
    actor: string;
  }): Promise<never> {
    throw new DomainError(
      "E2_AUTOMATION_REQUIRED",
      "A URL do Vercel Preview não pode mais ser anexada manualmente.",
      "Use a captura automática por branch e commit da E2.",
      410,
    );
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

  async issueQrCodes(
    id: string,
    input: { actor: string; public_base_url: string },
  ): Promise<EditorialPublication> {
    const publication = await this.requirePublication(id);
    if (!["PUBLISHED", "QR_FAILED"].includes(publication.status)) {
      throw new DomainError(
        "QR_PUBLICATION_REQUIRED",
        `Os QRs semânticos não podem ser emitidos em ${publication.status}.`,
        "Conclua a E3 e registre o commit publicado antes de iniciar a E4.",
        409,
      );
    }
    const actor = input.actor.trim() || publication.briefing.author;

    try {
      const existing = await this.qrRepository.listRoutes(publication.id);
      const existingByAction = new Map(
        existing.map((registration) => [registration.action, registration]),
      );
      const issuedAt = new Date().toISOString();
      const registrations: EditorialQrRegistration[] =
        EDITORIAL_QR_ACTIONS.map((action) => {
          const current = existingByAction.get(action);
          return current
            ? {
                ...current,
                status: "ACTIVE",
                access_policy: qrAccessPolicy(action),
                issued_by: actor,
              }
            : {
                publication_id: publication.id,
                action,
                token: createEditorialQrToken(),
                status: "ACTIVE",
                access_policy: qrAccessPolicy(action),
                issued_at: issuedAt,
                issued_by: actor,
              };
        });

      await this.qrRepository.saveRoutes(publication.id, registrations);
      const persisted = await this.qrRepository.listRoutes(publication.id);
      const activeActions = new Set(
        persisted
          .filter((route) => route.status === "ACTIVE")
          .map((route) => route.action),
      );
      if (!EDITORIAL_QR_ACTIONS.every((action) => activeActions.has(action))) {
        throw new DomainError(
          "QR_REGISTRY_INCOMPLETE",
          "O registro não confirmou os quatro QRs obrigatórios.",
          "Não imprima o painel; repita a emissão depois de verificar a migração E4.",
          502,
        );
      }

      const previousTokens = EDITORIAL_QR_ACTIONS.map(
        (action) => publication.qr.routes[action]?.token ?? null,
      );
      publication.qr = qrStateFromRegistrations(
        input.public_base_url,
        persisted,
      );
      const currentTokens = EDITORIAL_QR_ACTIONS.map(
        (action) => publication.qr.routes[action]?.token ?? null,
      );
      const changed = previousTokens.some(
        (token, index) => token !== currentTokens[index],
      );
      if (publication.status === "QR_FAILED") {
        this.changeStatus(
          publication,
          "PUBLISHED",
          actor,
          "E4 recuperada; os quatro QRs semânticos estão ativos.",
        );
      }
      if (changed) {
        publication.events.push(event(
          "QR_ISSUED",
          actor,
          "E4 emitiu QR-01 Criar, QR-02 Preview, QR-03 Aprovar e QR-04 Medir com tokens estáveis.",
        ));
      }
      publication.updated_at = timestampAfter(publication.updated_at);
      await this.store.savePublication(publication);
      return publication;
    } catch (caught) {
      if (publication.status === "PUBLISHED") {
        this.changeStatus(
          publication,
          "QR_FAILED",
          actor,
          "A emissão dos QRs semânticos falhou sem desfazer a publicação.",
        );
      }
      publication.events.push(event(
        "QR_ISSUE_FAILED",
        actor,
        caught instanceof Error ? caught.message : "Falha desconhecida na E4.",
      ));
      await this.store.savePublication(publication);
      if (caught instanceof DomainError) throw caught;
      throw new DomainError(
        "QR_ISSUE_FAILED",
        "Não foi possível emitir os QRs semânticos.",
        "A publicação permanece disponível; verifique o registro E4 e tente novamente.",
        502,
      );
    }
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

  private assertArtifactCanStart(publication: EditorialPublication): void {
    if (publication.status !== "READY_FOR_PREVIEW") {
      throw new DomainError(
        "E2_NOT_READY",
        `A E2 não pode ser iniciada em ${publication.status}.`,
        "Conclua o pacote e o gate interno da E1 antes de criar branch, commit e PR.",
        409,
      );
    }
    assertReadyForPreviewEvidence(publication);
  }

  private async requirePublication(id: string): Promise<EditorialPublication> {
    const publication = await this.store.getPublication(id);
    if (!publication) throw new DomainError("NOT_FOUND", `A publicação ${id} não existe.`, "Atualize a lista editorial.", 404);
    return normalizeEditorialPublication(structuredClone(publication));
  }
}
