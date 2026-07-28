import {
  EDITORIAL_ADAPTERS,
  EDITORIAL_ADAPTER_STATUSES,
  type EditorialAdapterEvidence,
  type EditorialAdapterName,
  type EditorialPublication,
} from "./types.js";
import { createInitialAdapterEvidence } from "./adapters.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeAdapter(
  adapter: EditorialAdapterName,
  value: unknown,
  publicationVersion: number,
): { evidence: EditorialAdapterEvidence; legacy: boolean } {
  const initial = createInitialAdapterEvidence(adapter, publicationVersion);
  if (typeof value === "string") {
    if (value === "APPLIED") {
      return {
        evidence: {
          ...initial,
          status: "STALE",
          findings: {
            errors: [],
            warnings: ["Resultado legado sem evidência de execução; execute novamente."],
            recommendations: [],
          },
        },
        legacy: true,
      };
    }
    if (value === "FAILED") {
      return {
        evidence: {
          ...initial,
          status: "FAILED",
          findings: {
            errors: ["A execução legada falhou sem evidência estruturada."],
            warnings: [],
            recommendations: [],
          },
        },
        legacy: true,
      };
    }
    return { evidence: initial, legacy: true };
  }

  if (!isRecord(value)) return { evidence: initial, legacy: true };
  const rawStatus = typeof value.status === "string" ? value.status : "";
  const status = EDITORIAL_ADAPTER_STATUSES.includes(
    rawStatus as typeof EDITORIAL_ADAPTER_STATUSES[number],
  )
    ? rawStatus as EditorialAdapterEvidence["status"]
    : "NOT_RUN";
  const findings = isRecord(value.findings) ? value.findings : {};
  const evidence: EditorialAdapterEvidence = {
    adapter,
    status,
    adapter_version: typeof value.adapter_version === "string" ? value.adapter_version : null,
    publication_version: Number.isInteger(value.publication_version)
      ? Number(value.publication_version)
      : publicationVersion,
    content_hash: typeof value.content_hash === "string" ? value.content_hash : null,
    started_at: typeof value.started_at === "string" ? value.started_at : null,
    completed_at: typeof value.completed_at === "string" ? value.completed_at : null,
    findings: {
      errors: stringArray(findings.errors),
      warnings: stringArray(findings.warnings),
      recommendations: stringArray(findings.recommendations),
    },
    output_reference: typeof value.output_reference === "string" ? value.output_reference : null,
    actor: typeof value.actor === "string" ? value.actor : null,
    skip_reason: typeof value.skip_reason === "string" ? value.skip_reason : null,
  };

  const incompleteApplied = evidence.status === "APPLIED" && (
    !evidence.adapter_version
    || !evidence.content_hash
    || !evidence.started_at
    || !evidence.completed_at
    || !evidence.output_reference
    || !evidence.actor
  );
  if (incompleteApplied) {
    evidence.status = "STALE";
    evidence.findings.warnings = [
      ...evidence.findings.warnings,
      "Resultado APPLIED incompleto; a evidência deve ser regenerada.",
    ];
  }
  return { evidence, legacy: incompleteApplied };
}

/**
 * Expands records created before the evidence-backed E1 quality gate without
 * trusting legacy APPLIED labels.
 * The API can keep reading the rollout safely while every state-changing
 * command persists the upgraded contract.
 */
export function normalizeEditorialPublication(
  publication: EditorialPublication,
): EditorialPublication {
  const raw = publication as EditorialPublication & {
    quality: EditorialPublication["quality"] & {
      gate_result?: EditorialPublication["quality"]["gate_result"];
      content_hash?: string | null;
      adapters: Record<string, unknown>;
    };
    content: EditorialPublication["content"] & { updated_at?: string };
    github: EditorialPublication["github"] & {
      publication_version?: number | null;
      content_hash?: string | null;
    };
  };

  raw.content.updated_at = raw.content.updated_at ?? raw.content.generated_at ?? raw.created_at;
  let legacyAdapterFound = false;
  const adapters = Object.fromEntries(EDITORIAL_ADAPTERS.map((adapter) => {
    const normalized = normalizeAdapter(adapter, raw.quality.adapters?.[adapter], raw.version);
    legacyAdapterFound ||= normalized.legacy;
    return [adapter, normalized.evidence];
  })) as EditorialPublication["quality"]["adapters"];

  raw.quality.adapters = adapters;
  raw.quality.gate_result = legacyAdapterFound
    ? "NOT_RUN"
    : raw.quality.gate_result ?? (raw.quality.valid ? "PASSED" : "NOT_RUN");
  raw.quality.content_hash = legacyAdapterFound ? null : raw.quality.content_hash ?? null;
  if (legacyAdapterFound) {
    raw.quality.valid = false;
    raw.quality.warnings = [
      ...new Set([
        ...raw.quality.warnings,
        "As regras internas precisam ser executadas novamente com evidência E1.",
      ]),
    ];
  }
  raw.github.publication_version = raw.github.publication_version ?? null;
  raw.github.content_hash = raw.github.content_hash ?? null;
  raw.github.artifact_contract_version = raw.github.artifact_contract_version ?? null;
  raw.github.artifact_paths = Array.isArray(raw.github.artifact_paths)
    ? raw.github.artifact_paths.filter((path): path is string => typeof path === "string")
    : [];
  raw.github.created_at = raw.github.created_at ?? null;
  raw.preview.commit_sha = raw.preview.commit_sha ?? null;
  return raw;
}
