import { DomainError } from "../domain/errors.js";
import type { EditorialPublication, EditorialStatus } from "./types.js";

const transitions: Record<EditorialStatus, readonly EditorialStatus[]> = {
  DRAFT: ["VALIDATING"],
  VALIDATING: ["READY_FOR_PREVIEW", "VALIDATION_FAILED"],
  VALIDATION_FAILED: ["DRAFT", "VALIDATING"],
  READY_FOR_PREVIEW: ["PREVIEW_BUILDING"],
  PREVIEW_BUILDING: ["PREVIEW_READY", "PREVIEW_FAILED"],
  PREVIEW_FAILED: ["READY_FOR_PREVIEW", "PREVIEW_BUILDING"],
  PREVIEW_READY: ["IN_REVIEW"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["DRAFT", "VALIDATING"],
  APPROVED: ["PUBLISHING", "IN_REVIEW"],
  PUBLISHING: ["PUBLISHED", "PUBLISH_FAILED"],
  PUBLISH_FAILED: ["APPROVED", "PUBLISHING"],
  PUBLISHED: ["QR_FAILED", "ARCHIVED"],
  QR_FAILED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

export function allowedEditorialTransitions(status: EditorialStatus): readonly EditorialStatus[] {
  return transitions[status];
}

export function assertEditorialTransition(publication: EditorialPublication, target: EditorialStatus): void {
  if (!transitions[publication.status].includes(target)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Não é permitido mover ${publication.status} para ${target}.`,
      `Transições permitidas: ${transitions[publication.status].join(", ") || "nenhuma"}.`,
      409,
    );
  }

  if (target === "READY_FOR_PREVIEW") {
    if (!publication.quality.valid || publication.quality.errors.length > 0) {
      throw new DomainError(
        "QUALITY_GATE_FAILED",
        "A publicação ainda não passou pelo gate editorial.",
        "Corrija os erros e execute a validação novamente.",
        409,
      );
    }
    if (!publication.content.markdown.trim()) {
      throw new DomainError(
        "CONTENT_REQUIRED",
        "O artigo precisa de conteúdo Markdown antes do preview.",
        "Atualize o conteúdo editorial e repita a validação.",
        422,
      );
    }
  }

  if (target === "PREVIEW_READY") {
    if (!publication.preview.url || !publication.github.commit_sha) {
      throw new DomainError(
        "PREVIEW_REQUIRED",
        "O preview e o commit precisam estar registrados.",
        "Anexe a URL da Vercel e o SHA do commit antes de concluir o preview.",
        409,
      );
    }
  }

  if (target === "APPROVED") {
    if (publication.approval.decision !== "APPROVED" || !publication.approval.reviewer || !publication.approval.decided_at) {
      throw new DomainError(
        "APPROVAL_REQUIRED",
        "A aprovação humana explícita ainda não foi registrada.",
        "Registre revisor, decisão e commit aprovado.",
        409,
      );
    }
    if (!publication.github.commit_sha || publication.approval.approved_commit_sha !== publication.github.commit_sha) {
      throw new DomainError(
        "APPROVAL_STALE",
        "A aprovação não corresponde ao commit atual.",
        "Revise novamente a versão corrente antes de publicar.",
        409,
      );
    }
  }

  if (target === "PUBLISHING") {
    if (publication.approval.decision !== "APPROVED" || publication.approval.approved_commit_sha !== publication.github.commit_sha) {
      throw new DomainError(
        "APPROVAL_REQUIRED",
        "Publicação automática sem aprovação humana é proibida.",
        "Aprove explicitamente o commit atual antes de iniciar a publicação.",
        409,
      );
    }
  }

  if (target === "PUBLISHED") {
    if (!publication.publication.url || !publication.publication.published_at) {
      throw new DomainError(
        "PUBLICATION_EVIDENCE_REQUIRED",
        "A URL e a data de publicação ainda não foram registradas.",
        "Registre a evidência do deployment antes de marcar como publicada.",
        409,
      );
    }
    if (publication.publication.commit_sha !== publication.github.commit_sha) {
      throw new DomainError(
        "PUBLICATION_COMMIT_MISMATCH",
        "O commit publicado difere do commit aprovado.",
        "Publique exatamente o SHA aprovado ou faça uma nova revisão.",
        409,
      );
    }
  }
}
