import type {
  AuditEvent,
  DecompositionProposal,
  EvidenceRecord,
  Project,
  Sprint,
  Task,
} from "../domain/entities.mjs";

/** Mirrors contracts/domain-types.ts RepositoryWriteOptions. */
export interface RepositoryWriteOptions {
  actorId: string;
  actorType?: AuditEvent["actorType"];
  requestId: string;
  idempotencyKey: string;
  expectedVersion?: number;
}

export interface WriteResult<T> {
  record: T;
  auditId: string;
  /** True when the write was skipped because the idempotency key was replayed. */
  replayed: boolean;
}

export interface EntityRepository<T> {
  getById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  create(record: T, options: RepositoryWriteOptions): Promise<WriteResult<T>>;
  update(record: T, options: RepositoryWriteOptions): Promise<WriteResult<T>>;
  /** Cheap listing from the per-type index manifest (no per-record reads). */
  summaries(): Promise<Array<Record<string, unknown>>>;
}

export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
  recent(limit?: number): Promise<Array<Record<string, unknown>>>;
}

export interface BackupService {
  /** Copies the given vault paths into a timestamped backup folder. */
  backupPaths(paths: string[], label: string): Promise<{ backupRef: string; copied: number }>;
}

export interface DeskOsRepositories {
  projects: EntityRepository<Project>;
  sprints: EntityRepository<Sprint>;
  tasks: EntityRepository<Task>;
  evidence: EntityRepository<EvidenceRecord>;
  proposals: EntityRepository<DecompositionProposal>;
  audit: AuditRepository;
  backup: BackupService;
}
