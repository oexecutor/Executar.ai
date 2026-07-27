export type EditorialStatus =
  | "DRAFT"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "READY_FOR_PREVIEW"
  | "PREVIEW_BUILDING"
  | "PREVIEW_FAILED"
  | "PREVIEW_READY"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PUBLISHING"
  | "PUBLISH_FAILED"
  | "PUBLISHED"
  | "QR_FAILED"
  | "ARCHIVED";

export interface EditorialPublicationSummary {
  id: string;
  title: string;
  slug: string;
  status: EditorialStatus;
  version: number;
  preview_url: string | null;
  publication_url: string | null;
  updated_at: string;
}

export interface EditorialPublication {
  id: string;
  version: number;
  status: EditorialStatus;
  briefing: {
    title: string;
    summary: string;
    audience: string;
    objective: string;
    author: string;
    source_text: string;
    keywords: string[];
    channel: "EXECUTA_JOURNAL";
    language: "pt-BR";
  };
  content: {
    slug: string;
    excerpt: string;
    markdown: string;
    reading_time_minutes: number;
    generated_at: string | null;
  };
  quality: {
    valid: boolean;
    score: number | null;
    errors: string[];
    warnings: string[];
    checked_at: string | null;
    adapters: {
      deskgo: "PENDING" | "APPLIED" | "FAILED";
      frankwatching: "PENDING" | "APPLIED" | "FAILED";
      ames: "PENDING" | "APPLIED" | "FAILED";
    };
  };
  github: {
    branch: string | null;
    pull_request_number: number | null;
    pull_request_url: string | null;
    commit_sha: string | null;
  };
  preview: {
    deployment_id: string | null;
    url: string | null;
    created_at: string | null;
  };
  approval: {
    decision: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
    reviewer: string | null;
    note: string | null;
    decided_at: string | null;
    approved_commit_sha: string | null;
  };
  publication: {
    url: string | null;
    published_at: string | null;
    commit_sha: string | null;
  };
  events: Array<{
    id: string;
    type: string;
    at: string;
    actor: string;
    detail: string;
    from_status?: EditorialStatus;
    to_status?: EditorialStatus;
  }>;
  created_at: string;
  updated_at: string;
}
