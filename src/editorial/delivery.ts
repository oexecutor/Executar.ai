import { DomainError } from "../domain/errors.js";
import type { EditorialPublication } from "./types.js";

export interface EditorialArtifactInput {
  publication: EditorialPublication;
  content_hash: string;
}

export interface EditorialArtifactResult {
  branch: string;
  commit_sha: string;
  pull_request_number: number;
  pull_request_url: string;
  artifact_paths: string[];
  created_at: string;
}

export interface EditorialArtifactPublisher {
  publish(input: EditorialArtifactInput): Promise<EditorialArtifactResult>;
}

export type EditorialPreviewResolution =
  | { state: "PENDING" }
  | { state: "FAILED"; detail: string }
  | {
    state: "READY";
    deployment_id: string;
    url: string;
    commit_sha: string;
    created_at: string;
  };

export interface EditorialPreviewResolver {
  resolve(input: {
    branch: string;
    commit_sha: string;
  }): Promise<EditorialPreviewResolution>;
}

export class UnavailableEditorialArtifactPublisher implements EditorialArtifactPublisher {
  async publish(): Promise<never> {
    throw new DomainError(
      "E2_GITHUB_NOT_CONFIGURED",
      "A automação GitHub da E2 não está configurada no servidor.",
      "Configure EDITORIAL_GITHUB_TOKEN, EDITORIAL_GITHUB_REPOSITORY e EDITORIAL_GITHUB_BASE_BRANCH no ambiente server-side.",
      503,
    );
  }
}

export class UnavailableEditorialPreviewResolver implements EditorialPreviewResolver {
  async resolve(): Promise<never> {
    throw new DomainError(
      "E2_VERCEL_NOT_CONFIGURED",
      "A captura automática do Vercel Preview não está configurada no servidor.",
      "Configure EDITORIAL_VERCEL_TOKEN, EDITORIAL_VERCEL_PROJECT_ID e EDITORIAL_VERCEL_TEAM_ID no ambiente server-side.",
      503,
    );
  }
}
