import { editorialContentHash, hasCurrentAppliedEvidence } from "./adapters.js";
import {
  EDITORIAL_ADAPTERS,
  EDITORIAL_ADAPTER_STATUSES,
  EDITORIAL_STATUSES,
  type EditorialPublication,
  type EditorialValidationResult,
} from "./types.js";

const statusSet = new Set<string>(EDITORIAL_STATUSES);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publicationIdPattern = /^PUB-[A-Za-z0-9-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requiresPreview(status: string): boolean {
  return ["PREVIEW_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED", "QR_FAILED", "ARCHIVED"].includes(status);
}

function requiresGitHubArtifact(status: string): boolean {
  return ["PREVIEW_BUILDING", "PREVIEW_FAILED", "PREVIEW_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED", "QR_FAILED", "ARCHIVED"].includes(status);
}

function requiresPassedGate(status: string): boolean {
  return ["READY_FOR_PREVIEW", "PREVIEW_BUILDING", "PREVIEW_FAILED", "PREVIEW_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED", "QR_FAILED", "ARCHIVED"].includes(status);
}

function requiresApproval(status: string): boolean {
  return ["APPROVED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED", "QR_FAILED", "ARCHIVED"].includes(status);
}

export function validateEditorialPublication(input: unknown): EditorialValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["A publicação editorial deve ser um objeto JSON."], warnings };
  }

  const publication = input as unknown as EditorialPublication;

  if (!publicationIdPattern.test(publication.id ?? "")) errors.push("id deve usar o formato PUB-…");
  if (!Number.isInteger(publication.version) || publication.version < 1) errors.push("version deve ser um inteiro positivo.");
  if (!statusSet.has(publication.status ?? "")) errors.push("status editorial inválido.");
  if (!hasText(publication.created_at) || !hasText(publication.updated_at)) errors.push("created_at e updated_at são obrigatórios.");

  if (!isRecord(publication.briefing)) {
    errors.push("briefing é obrigatório.");
  } else {
    const requiredBriefing: Array<[keyof EditorialPublication["briefing"], string]> = [
      ["title", "briefing.title"],
      ["summary", "briefing.summary"],
      ["audience", "briefing.audience"],
      ["objective", "briefing.objective"],
      ["author", "briefing.author"],
      ["source_text", "briefing.source_text"],
    ];
    for (const [key, label] of requiredBriefing) {
      if (!hasText(publication.briefing[key])) errors.push(`${label} é obrigatório.`);
    }
    if (publication.briefing.channel !== "EXECUTA_JOURNAL") errors.push("briefing.channel deve ser EXECUTA_JOURNAL.");
    if (publication.briefing.language !== "pt-BR") errors.push("briefing.language deve ser pt-BR.");
    if (!Array.isArray(publication.briefing.keywords)) errors.push("briefing.keywords deve ser uma lista.");
  }

  if (!isRecord(publication.content)) {
    errors.push("content é obrigatório.");
  } else {
    if (!hasText(publication.content.slug) || !slugPattern.test(publication.content.slug)) {
      errors.push("content.slug deve usar letras minúsculas, números e hífens.");
    }
    if (!hasText(publication.content.excerpt)) errors.push("content.excerpt é obrigatório.");
    if (!hasText(publication.content.markdown)) warnings.push("content.markdown ainda não foi produzido.");
    if (!hasText(publication.content.updated_at)) errors.push("content.updated_at é obrigatório.");
    if (!Number.isFinite(publication.content.reading_time_minutes) || publication.content.reading_time_minutes < 0) {
      errors.push("content.reading_time_minutes deve ser zero ou maior.");
    }
  }

  if (!isRecord(publication.quality)) {
    errors.push("quality é obrigatório.");
  } else {
    if (!Array.isArray(publication.quality.errors) || !Array.isArray(publication.quality.warnings)) {
      errors.push("quality.errors e quality.warnings devem ser listas.");
    }
    if (publication.quality.score !== null && (!Number.isFinite(publication.quality.score) || publication.quality.score < 0 || publication.quality.score > 100)) {
      errors.push("quality.score deve estar entre 0 e 100.");
    }
    if (!["NOT_RUN", "PASSED", "FAILED"].includes(publication.quality.gate_result)) {
      errors.push("quality.gate_result inválido.");
    }
    if (!isRecord(publication.quality.adapters)) {
      errors.push("quality.adapters é obrigatório.");
    } else {
      for (const adapter of EDITORIAL_ADAPTERS) {
        const evidence = publication.quality.adapters[adapter];
        if (!isRecord(evidence)) {
          errors.push(`quality.adapters.${adapter} é obrigatório.`);
          continue;
        }
        if (evidence.adapter !== adapter) errors.push(`${adapter}.adapter não corresponde à chave.`);
        if (!EDITORIAL_ADAPTER_STATUSES.includes(evidence.status)) errors.push(`${adapter}.status inválido.`);
        if (!Number.isInteger(evidence.publication_version) || evidence.publication_version < 1) {
          errors.push(`${adapter}.publication_version deve ser um inteiro positivo.`);
        }
        if (!isRecord(evidence.findings)
          || !Array.isArray(evidence.findings.errors)
          || !Array.isArray(evidence.findings.warnings)
          || !Array.isArray(evidence.findings.recommendations)) {
          errors.push(`${adapter}.findings deve conter errors, warnings e recommendations.`);
        }
        if (evidence.status === "APPLIED") {
          if (
            !hasText(evidence.adapter_version)
            || !hasText(evidence.content_hash)
            || !hasText(evidence.started_at)
            || !hasText(evidence.completed_at)
            || !hasText(evidence.output_reference)
            || !hasText(evidence.actor)
          ) {
            errors.push(`${adapter}=APPLIED exige evidência completa de execução.`);
          }
        }
        if (evidence.status === "RUNNING" && !hasText(evidence.started_at)) {
          errors.push(`${adapter}=RUNNING exige started_at.`);
        }
        if (evidence.status === "SKIPPED" && !hasText(evidence.skip_reason)) {
          errors.push(`${adapter}=SKIPPED exige justificativa explícita.`);
        }
      }
    }
  }

  if (requiresPassedGate(publication.status)) {
    const currentHash = editorialContentHash(publication);
    if (!publication.quality.valid || publication.quality.gate_result !== "PASSED") {
      errors.push(`${publication.status} exige gate técnico aprovado.`);
    }
    if (publication.quality.content_hash !== currentHash) {
      errors.push(`${publication.status} exige quality.content_hash correspondente ao conteúdo atual.`);
    }
    if (
      !hasText(publication.quality.checked_at)
      || Date.parse(publication.quality.checked_at) <= Date.parse(publication.content.updated_at)
    ) {
      errors.push(`${publication.status} exige gate posterior à última alteração do conteúdo.`);
    }
    for (const adapter of EDITORIAL_ADAPTERS) {
      if (!hasCurrentAppliedEvidence(publication.quality.adapters[adapter], publication, currentHash)) {
        errors.push(`${publication.status} exige a regra interna ${adapter}=APPLIED com evidência da versão atual.`);
      }
    }
  }

  if (requiresGitHubArtifact(publication.status)) {
    if (
      !hasText(publication.github?.branch)
      || !hasText(publication.github?.commit_sha)
      || !Number.isInteger(publication.github?.pull_request_number)
      || !hasText(publication.github?.pull_request_url)
    ) {
      errors.push(`${publication.status} exige branch, commit e pull request da E2.`);
    }
    if (!/^[0-9a-f]{40}$/i.test(publication.github?.commit_sha ?? "")) {
      errors.push(`${publication.status} exige github.commit_sha SHA-1 completo.`);
    }
    if (
      publication.github?.artifact_contract_version !== "1.0"
      || !Array.isArray(publication.github?.artifact_paths)
      || publication.github.artifact_paths.length < 2
      || !hasText(publication.github?.created_at)
    ) {
      errors.push(`${publication.status} exige pacote editorial automático com caminhos e timestamp.`);
    }
    if (publication.github?.publication_version !== publication.version) {
      errors.push(`${publication.status} exige github.publication_version atual.`);
    }
    if (publication.github?.content_hash !== publication.quality.content_hash) {
      errors.push(`${publication.status} exige github.content_hash aprovado.`);
    }
  }

  if (requiresPreview(publication.status)) {
    if (!hasText(publication.preview?.url)) errors.push(`${publication.status} exige preview.url.`);
    if (!hasText(publication.preview?.deployment_id)) errors.push(`${publication.status} exige preview.deployment_id.`);
    if (!hasText(publication.preview?.commit_sha)) errors.push(`${publication.status} exige preview.commit_sha.`);
    if (publication.preview?.commit_sha !== publication.github?.commit_sha) {
      errors.push(`${publication.status} exige Preview do mesmo commit GitHub.`);
    }
  }

  if (requiresApproval(publication.status)) {
    if (publication.approval?.decision !== "APPROVED") errors.push(`${publication.status} exige approval.decision=APPROVED.`);
    if (!hasText(publication.approval?.reviewer) || !hasText(publication.approval?.decided_at)) {
      errors.push(`${publication.status} exige reviewer e decided_at.`);
    }
    if (!hasText(publication.approval?.approved_commit_sha)) errors.push(`${publication.status} exige approved_commit_sha.`);
    if (publication.github?.commit_sha && publication.approval?.approved_commit_sha !== publication.github.commit_sha) {
      errors.push("A aprovação não corresponde ao commit atual.");
    }
  }

  if (["PUBLISHED", "QR_FAILED", "ARCHIVED"].includes(publication.status)) {
    if (!hasText(publication.publication?.url) || !hasText(publication.publication?.published_at)) {
      errors.push(`${publication.status} exige publication.url e publication.published_at.`);
    }
    if (publication.publication?.commit_sha !== publication.github?.commit_sha) {
      errors.push("A publicação deve apontar para o mesmo commit aprovado.");
    }
  }

  if (!Array.isArray(publication.events) || publication.events.length < 1) errors.push("events deve conter ao menos o evento CREATED.");

  return { valid: errors.length === 0, errors, warnings };
}
