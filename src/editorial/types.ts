export const EDITORIAL_STATUSES = [
  "DRAFT",
  "CONTENT_READY",
  "ENRICHING",
  "ADAPTERS_APPLIED",
  "ADAPTER_FAILED",
  "VALIDATING",
  "VALIDATION_FAILED",
  "READY_FOR_PREVIEW",
  "PREVIEW_BUILDING",
  "PREVIEW_FAILED",
  "PREVIEW_READY",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHING",
  "PUBLISH_FAILED",
  "PUBLISHED",
  "QR_FAILED",
  "ARCHIVED",
] as const;

export type EditorialStatus = typeof EDITORIAL_STATUSES[number];

export const EDITORIAL_ADAPTERS = ["deskgo", "frankwatching", "ames"] as const;
export type EditorialAdapterName = typeof EDITORIAL_ADAPTERS[number];

export const EDITORIAL_ADAPTER_STATUSES = [
  "NOT_RUN",
  "RUNNING",
  "APPLIED",
  "FAILED",
  "STALE",
  "SKIPPED",
] as const;
export type EditorialAdapterStatus = typeof EDITORIAL_ADAPTER_STATUSES[number];

export interface EditorialBriefing {
  title: string;
  summary: string;
  audience: string;
  objective: string;
  author: string;
  source_text: string;
  keywords: string[];
  channel: "EXECUTA_JOURNAL";
  language: "pt-BR";
}

export interface EditorialContent {
  slug: string;
  excerpt: string;
  markdown: string;
  reading_time_minutes: number;
  generated_at: string | null;
  updated_at: string;
}

export interface EditorialAdapterFindings {
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface EditorialAdapterEvidence {
  adapter: EditorialAdapterName;
  status: EditorialAdapterStatus;
  adapter_version: string | null;
  publication_version: number;
  content_hash: string | null;
  started_at: string | null;
  completed_at: string | null;
  findings: EditorialAdapterFindings;
  output_reference: string | null;
  actor: string | null;
  skip_reason: string | null;
}

export interface EditorialQuality {
  valid: boolean;
  gate_result: "NOT_RUN" | "PASSED" | "FAILED";
  score: number | null;
  errors: string[];
  warnings: string[];
  checked_at: string | null;
  content_hash: string | null;
  adapters: Record<EditorialAdapterName, EditorialAdapterEvidence>;
}

export interface EditorialGitHubState {
  branch: string | null;
  pull_request_number: number | null;
  pull_request_url: string | null;
  commit_sha: string | null;
  publication_version: number | null;
  content_hash: string | null;
}

export interface EditorialPreviewState {
  deployment_id: string | null;
  url: string | null;
  created_at: string | null;
}

export interface EditorialApproval {
  decision: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  reviewer: string | null;
  note: string | null;
  decided_at: string | null;
  approved_commit_sha: string | null;
}

export interface EditorialPublicationState {
  url: string | null;
  published_at: string | null;
  commit_sha: string | null;
}

export interface EditorialQrState {
  create_url: string | null;
  preview_url: string | null;
  approve_url: string | null;
  analytics_url: string | null;
}

export interface EditorialEvent {
  id: string;
  type:
    | "CREATED"
    | "CONTENT_UPDATED"
    | "STATUS_CHANGED"
    | "ADAPTER_STARTED"
    | "ADAPTER_COMPLETED"
    | "ADAPTER_FAILED"
    | "GATE_COMPLETED"
    | "PREVIEW_ATTACHED"
    | "REVIEW_RECORDED"
    | "PUBLISHED";
  at: string;
  actor: string;
  detail: string;
  from_status?: EditorialStatus;
  to_status?: EditorialStatus;
}

export interface EditorialPublication {
  id: string;
  version: number;
  status: EditorialStatus;
  briefing: EditorialBriefing;
  content: EditorialContent;
  quality: EditorialQuality;
  github: EditorialGitHubState;
  preview: EditorialPreviewState;
  approval: EditorialApproval;
  publication: EditorialPublicationState;
  qr: EditorialQrState;
  events: EditorialEvent[];
  created_at: string;
  updated_at: string;
}

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

export interface EditorialValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
