import { EDITORIAL_STATUSES, type EditorialPublication, type EditorialValidationResult } from "./types.js";

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
  }

  if (requiresPreview(publication.status)) {
    if (!hasText(publication.preview?.url)) errors.push(`${publication.status} exige preview.url.`);
    if (!hasText(publication.github?.commit_sha)) errors.push(`${publication.status} exige github.commit_sha.`);
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
