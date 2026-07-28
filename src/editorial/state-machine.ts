import { DomainError } from "../domain/errors.js";
import { editorialContentHash, hasCurrentAppliedEvidence } from "./adapters.js";
import { EDITORIAL_ADAPTERS } from "./types.js";
import type { EditorialPublication, EditorialStatus } from "./types.js";

const transitions: Record<EditorialStatus, readonly EditorialStatus[]> = {
  DRAFT: ["CONTENT_READY"],
  CONTENT_READY: ["DRAFT", "ENRICHING"],
  ENRICHING: ["DRAFT", "ADAPTERS_APPLIED", "ADAPTER_FAILED"],
  ADAPTERS_APPLIED: ["DRAFT", "ENRICHING", "VALIDATING"],
  ADAPTER_FAILED: ["DRAFT", "ENRICHING"],
  VALIDATING: ["READY_FOR_PREVIEW", "VALIDATION_FAILED"],
  VALIDATION_FAILED: ["DRAFT", "CONTENT_READY"],
  READY_FOR_PREVIEW: ["PREVIEW_BUILDING"],
  PREVIEW_BUILDING: ["PREVIEW_READY", "PREVIEW_FAILED"],
  PREVIEW_FAILED: ["READY_FOR_PREVIEW", "PREVIEW_BUILDING"],
  PREVIEW_READY: ["IN_REVIEW"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["DRAFT", "CONTENT_READY"],
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

export function assertReadyForPreviewEvidence(publication: EditorialPublication): void {
  const contentHash = editorialContentHash(publication);
  const adapterMissing = EDITORIAL_ADAPTERS.filter((adapter) =>
    !hasCurrentAppliedEvidence(publication.quality.adapters[adapter], publication, contentHash)
  );

  if (
    !publication.quality.valid
    || publication.quality.gate_result !== "PASSED"
    || publication.quality.errors.length > 0
  ) {
    throw new DomainError(
      "QUALITY_GATE_FAILED",
      "A publicação ainda não passou pelo gate editorial final.",
      "Execute os três adapters e repita o gate editorial.",
      409,
    );
  }
  if (adapterMissing.length > 0) {
    throw new DomainError(
      "ADAPTER_EVIDENCE_REQUIRED",
      `Adapters obrigatórios sem evidência válida: ${adapterMissing.join(", ")}.`,
      "Execute novamente os critérios editoriais sobre a versão atual.",
      409,
    );
  }
  if (publication.quality.content_hash !== contentHash) {
    throw new DomainError(
      "QUALITY_GATE_STALE",
      "O hash validado não corresponde ao conteúdo atual.",
      "Execute os adapters e o gate editorial novamente.",
      409,
    );
  }
  if (
    !publication.quality.checked_at
    || Date.parse(publication.quality.checked_at) <= Date.parse(publication.content.updated_at)
  ) {
    throw new DomainError(
      "QUALITY_GATE_STALE",
      "O gate editorial é anterior à última alteração do conteúdo.",
      "Valide novamente a versão atual antes de criar o Preview.",
      409,
    );
  }
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
    assertReadyForPreviewEvidence(publication);
    if (!publication.content.markdown.trim()) {
      throw new DomainError(
        "CONTENT_REQUIRED",
        "O artigo precisa de conteúdo Markdown antes do preview.",
        "Atualize o conteúdo editorial e repita a validação.",
        422,
      );
    }
  }

  if (target === "PREVIEW_BUILDING") {
    assertReadyForPreviewEvidence(publication);
  }

  if (target === "PREVIEW_READY") {
    if (!publication.preview.url || !publication.preview.deployment_id || !publication.github.commit_sha) {
      throw new DomainError(
        "PREVIEW_REQUIRED",
        "O Preview, o deployment e o commit precisam estar registrados.",
        "Anexe a URL imutável, o deployment da Vercel e o SHA do commit.",
        409,
      );
    }
    if (
      publication.github.publication_version !== publication.version
      || publication.github.content_hash !== publication.quality.content_hash
    ) {
      throw new DomainError(
        "PREVIEW_CONTENT_MISMATCH",
        "O artefato GitHub não corresponde à versão editorial validada.",
        "Registre um commit criado a partir da versão e do hash aprovados.",
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
