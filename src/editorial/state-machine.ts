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
      "A publicação ainda não passou pelo gate interno da E1.",
      "Execute as três regras internas e repita o gate da E1.",
      409,
    );
  }
  if (adapterMissing.length > 0) {
    throw new DomainError(
      "ADAPTER_EVIDENCE_REQUIRED",
      `Regras internas sem evidência válida: ${adapterMissing.join(", ")}.`,
      "Execute novamente as verificações internas sobre a versão atual.",
      409,
    );
  }
  if (publication.quality.content_hash !== contentHash) {
    throw new DomainError(
      "QUALITY_GATE_STALE",
      "O hash validado não corresponde ao conteúdo atual.",
      "Execute as regras internas e o gate da E1 novamente.",
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

export function assertGitHubArtifactEvidence(publication: EditorialPublication): void {
  if (
    !publication.github.branch
    || !publication.github.commit_sha
    || !/^[0-9a-f]{40}$/i.test(publication.github.commit_sha)
    || !publication.github.pull_request_number
    || !publication.github.pull_request_url
    || !/^https:\/\/github\.com\//i.test(publication.github.pull_request_url)
  ) {
    throw new DomainError(
      "E2_GITHUB_EVIDENCE_REQUIRED",
      "A E2 exige branch, commit e pull request criados automaticamente.",
      "Crie novamente o artefato GitHub a partir do pacote aprovado na E1.",
      409,
    );
  }
  if (
    publication.github.artifact_contract_version !== "1.0"
    || publication.github.artifact_paths.length < 2
    || !publication.github.created_at
  ) {
    throw new DomainError(
      "E2_ARTIFACT_EVIDENCE_REQUIRED",
      "O pacote editorial da E2 não possui evidência completa.",
      "Grave artigo, metadados e assets pelo publisher automático.",
      409,
    );
  }
  if (
    publication.github.publication_version !== publication.version
    || publication.github.content_hash !== publication.quality.content_hash
  ) {
    throw new DomainError(
      "E2_ARTIFACT_STALE",
      "O pacote GitHub não corresponde à versão e ao hash aprovados na E1.",
      "Gere novamente o artefato a partir do conteúdo atual.",
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
    assertGitHubArtifactEvidence(publication);
  }

  if (target === "PREVIEW_READY") {
    assertGitHubArtifactEvidence(publication);
    if (
      !publication.preview.url
      || !publication.preview.deployment_id
      || !publication.preview.commit_sha
    ) {
      throw new DomainError(
        "PREVIEW_REQUIRED",
        "O Preview, o deployment e o commit precisam estar registrados.",
        "Capture automaticamente a URL imutável e o deployment da Vercel.",
        409,
      );
    }
    if (publication.preview.commit_sha !== publication.github.commit_sha) {
      throw new DomainError(
        "PREVIEW_CONTENT_MISMATCH",
        "O Vercel Preview não corresponde ao commit do pacote editorial.",
        "Resolva novamente o deployment usando o SHA exato do PR.",
        409,
      );
    }
  }

  if (target === "IN_REVIEW") {
    assertGitHubArtifactEvidence(publication);
    if (
      !publication.preview.url
      || !publication.preview.deployment_id
      || publication.preview.commit_sha !== publication.github.commit_sha
    ) {
      throw new DomainError(
        "E2_PREVIEW_EVIDENCE_REQUIRED",
        "A revisão humana exige a E2 concluída para o mesmo commit.",
        "Capture automaticamente o Vercel Preview antes de iniciar a E3.",
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
