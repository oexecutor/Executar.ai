import type { Store } from "@netlify/blobs";
import { BlobVaultService, VaultProblem } from "../lib/vault.mjs";
import { DomainError } from "../domain/errors.mjs";
import { newId } from "../domain/ids.mjs";
import type {
  AuditEvent,
  DecompositionProposal,
  EvidenceRecord,
  Project,
  Sprint,
  Task,
} from "../domain/entities.mjs";
import type {
  AuditRepository,
  BackupService,
  DeskOsRepositories,
  EntityRepository,
  RepositoryWriteOptions,
  WriteResult,
} from "./interfaces.mjs";
import {
  auditIndexPath,
  auditPath,
  backupFolder,
  idempotencyPath,
  indexPath,
  stateFolder,
  statePath,
  type RecordType,
} from "./paths.mjs";

const SCHEMA_VERSION = "1.0.0";
const AUDIT_INDEX_LIMIT = 500;

interface TypeIndex {
  schemaVersion: string;
  updatedAt: string;
  entries: Record<string, Record<string, unknown>>;
}

interface IdempotencyReceipt {
  key: string;
  action: string;
  entityType: string;
  entityId: string;
  auditId: string;
  at: string;
}

type Versioned = { id: string; version: number; updatedAt: string };

/**
 * JSON-over-vault engine. Uses the EXISTING BlobVaultService for record
 * reads/writes (single source of truth) and key-only blob listing for
 * recovery scans, so ordinary reads never fan out over the whole vault
 * (baseline §4/§11.2).
 */
class VaultStateStore {
  readonly vault: BlobVaultService;

  constructor(private readonly store: Store) {
    // The only caller allowed to write inside _desk-os/ — see the guard
    // comment on BlobVaultService.assertWritable in src/lib/vault.mts.
    this.vault = new BlobVaultService(store, { allowReservedPaths: true });
  }

  async readJson<T>(path: string): Promise<T | null> {
    try {
      const { bytes } = await this.vault.getFileBytes(path);
      return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
    } catch (error) {
      if (error instanceof VaultProblem && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    await this.vault.putText(path, JSON.stringify(value, null, 2));
  }

  /** Key-only listing (no per-record get) of vault paths under a folder. */
  async listPathsUnder(folder: string): Promise<string[]> {
    const prefix = `file/${encodeURIComponent(`${folder}/`)}`;
    const result = (await this.store.list({ prefix })) as { blobs: Array<{ key: string }> };
    return result.blobs.map((blob) => decodeURIComponent(blob.key.slice("file/".length))).sort();
  }
}

class VaultEntityRepository<T extends Versioned> implements EntityRepository<T> {
  constructor(
    private readonly state: VaultStateStore,
    private readonly type: RecordType,
    private readonly summarize: (record: T) => Record<string, unknown>,
    private readonly audit: VaultAuditRepository,
  ) {}

  async getById(id: string): Promise<T | null> {
    return this.state.readJson<T>(statePath(this.type, id));
  }

  private async requireById(id: string): Promise<T> {
    const record = await this.getById(id);
    if (!record) {
      throw new DomainError("NOT_FOUND", `${this.type} ${id} not found.`, "Check the id with the list tools.", 404);
    }
    return record;
  }

  async list(): Promise<T[]> {
    const index = await this.readIndex();
    const records: T[] = [];
    for (const id of Object.keys(index.entries)) {
      const record = await this.getById(id);
      if (record) records.push(record);
    }
    return records;
  }

  async summaries(): Promise<Array<Record<string, unknown>>> {
    const index = await this.readIndex();
    return Object.values(index.entries);
  }

  async create(record: T, options: RepositoryWriteOptions): Promise<WriteResult<T>> {
    const replay = await this.findReplay(record, "create", options);
    if (replay) return replay;
    const existing = await this.getById(record.id);
    if (existing) {
      throw new DomainError("ALREADY_EXISTS", `${this.type} ${record.id} already exists.`, "Use update instead.", 409);
    }
    return this.persist(record, "create", options);
  }

  async update(record: T, options: RepositoryWriteOptions): Promise<WriteResult<T>> {
    const replay = await this.findReplay(record, "update", options);
    if (replay) return replay;
    const current = await this.requireById(record.id);
    if (options.expectedVersion !== undefined && current.version !== options.expectedVersion) {
      throw new DomainError(
        "VERSION_CONFLICT",
        `${this.type} ${record.id} is at version ${current.version}, expected ${options.expectedVersion}.`,
        "Re-read the record and retry with the current version.",
        409,
      );
    }
    const next = { ...record, version: current.version + 1, updatedAt: new Date().toISOString() };
    return this.persist(next, "update", options);
  }

  /** PM-204: a replayed idempotency key returns the original result instead of duplicating. */
  private async findReplay(
    record: T,
    action: string,
    options: RepositoryWriteOptions,
  ): Promise<WriteResult<T> | null> {
    const receipt = await this.state.readJson<IdempotencyReceipt>(idempotencyPath(options.idempotencyKey));
    if (!receipt) return null;
    if (receipt.entityType !== this.type || receipt.action !== action) {
      throw new DomainError(
        "IDEMPOTENCY_REUSE",
        `Idempotency key was already used for ${receipt.action} ${receipt.entityType} ${receipt.entityId}.`,
        "Use a fresh idempotency key per logical operation.",
        409,
      );
    }
    const existing = await this.getById(receipt.entityId);
    if (!existing) return null;
    return { record: existing, auditId: receipt.auditId, replayed: true };
  }

  private async persist(record: T, action: string, options: RepositoryWriteOptions): Promise<WriteResult<T>> {
    await this.state.writeJson(statePath(this.type, record.id), record);
    await this.upsertIndexEntry(record);
    const auditId = await this.audit.appendForWrite({
      action: `${this.type}.${action}`,
      entityType: this.type,
      entityId: record.id,
      options,
      detail: { version: record.version },
    });
    await this.state.writeJson(idempotencyPath(options.idempotencyKey), {
      key: options.idempotencyKey,
      action,
      entityType: this.type,
      entityId: record.id,
      auditId,
      at: new Date().toISOString(),
    } satisfies IdempotencyReceipt);
    return { record, auditId, replayed: false };
  }

  private async readIndex(): Promise<TypeIndex> {
    const index = await this.state.readJson<TypeIndex>(indexPath(this.type));
    if (index && index.schemaVersion === SCHEMA_VERSION) return index;
    return this.rebuildIndex();
  }

  private async upsertIndexEntry(record: T): Promise<void> {
    const index = await this.readIndex();
    index.entries[record.id] = this.summarize(record);
    index.updatedAt = new Date().toISOString();
    await this.state.writeJson(indexPath(this.type), index);
  }

  /** PM-207: deterministic recovery scan over the type's state folder only. */
  async rebuildIndex(): Promise<TypeIndex> {
    const paths = await this.state.listPathsUnder(stateFolder(this.type));
    const entries: Record<string, Record<string, unknown>> = {};
    for (const path of paths) {
      const record = await this.state.readJson<T>(path);
      if (record?.id) entries[record.id] = this.summarize(record);
    }
    const index: TypeIndex = { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString(), entries };
    await this.state.writeJson(indexPath(this.type), index);
    return index;
  }
}

class VaultAuditRepository implements AuditRepository {
  constructor(private readonly state: VaultStateStore) {}

  async appendForWrite(input: {
    action: string;
    entityType: string;
    entityId: string;
    options: RepositoryWriteOptions;
    detail?: Record<string, unknown>;
  }): Promise<string> {
    const event: AuditEvent = {
      id: newId("audit"),
      at: new Date().toISOString(),
      actorType: input.options.actorType ?? "SYSTEM",
      actorId: input.options.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.options.requestId,
      idempotencyKey: input.options.idempotencyKey,
      detail: input.detail ?? {},
    };
    await this.append(event);
    return event.id;
  }

  async append(event: AuditEvent): Promise<void> {
    await this.state.writeJson(auditPath(event.at, event.id), event);
    const index =
      (await this.state.readJson<{ entries: Array<Record<string, unknown>> }>(auditIndexPath())) ?? {
        entries: [],
      };
    index.entries.push({
      id: event.id,
      at: event.at,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
    });
    if (index.entries.length > AUDIT_INDEX_LIMIT) {
      index.entries = index.entries.slice(-AUDIT_INDEX_LIMIT);
    }
    await this.state.writeJson(auditIndexPath(), index);
  }

  async recent(limit = 50): Promise<Array<Record<string, unknown>>> {
    const index = await this.state.readJson<{ entries: Array<Record<string, unknown>> }>(auditIndexPath());
    return (index?.entries ?? []).slice(-limit).reverse();
  }
}

class VaultBackupService implements BackupService {
  constructor(private readonly state: VaultStateStore) {}

  /** PM-206: copy current records into a timestamped folder before bulk apply. */
  async backupPaths(paths: string[], label: string): Promise<{ backupRef: string; copied: number }> {
    const folder = backupFolder(new Date().toISOString(), label);
    let copied = 0;
    for (const path of paths) {
      const value = await this.state.readJson<unknown>(path);
      if (value === null) continue;
      await this.state.writeJson(`${folder}/${path}`, value);
      copied += 1;
    }
    await this.state.writeJson(`${folder}/MANIFEST.json`, {
      label,
      createdAt: new Date().toISOString(),
      paths,
      copied,
    });
    return { backupRef: folder, copied };
  }
}

function projectSummary(record: Project): Record<string, unknown> {
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    priority: record.priority,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

function sprintSummary(record: Sprint): Record<string, unknown> {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

function taskSummary(record: Task): Record<string, unknown> {
  return {
    id: record.id,
    projectId: record.projectId,
    sprintId: record.sprintId,
    title: record.title,
    status: record.status,
    priority: record.priority,
    position: record.position,
    dominantDate: record.dominantDate,
    dueAt: record.dueAt,
    blockedReason: record.blockedReason,
    stepsTotal: record.steps.length,
    stepsDone: record.steps.filter((step) => step.status === "DONE").length,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

function evidenceSummary(record: EvidenceRecord): Record<string, unknown> {
  return {
    id: record.id,
    projectId: record.projectId,
    taskId: record.taskId,
    type: record.type,
    confidence: record.confidence,
    statement: record.statement.slice(0, 200),
    createdAt: record.createdAt,
  };
}

function proposalSummary(record: DecompositionProposal): Record<string, unknown> {
  return {
    id: record.id,
    projectId: record.projectId,
    status: record.status,
    taskDrafts: record.changes.taskDrafts.length,
    sprintDrafts: record.changes.sprintDrafts.length,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

/** Evidence records are append-only; wrap them with a synthetic version. */
type VersionedEvidence = EvidenceRecord & { version: number; updatedAt: string };

export function createDeskOsRepositories(store: Store): DeskOsRepositories {
  const state = new VaultStateStore(store);
  const audit = new VaultAuditRepository(state);
  const evidenceRepo = new VaultEntityRepository<VersionedEvidence>(
    state,
    "evidence",
    (record) => evidenceSummary(record),
    audit,
  );
  return {
    projects: new VaultEntityRepository<Project>(state, "project", projectSummary, audit),
    sprints: new VaultEntityRepository<Sprint>(state, "sprint", sprintSummary, audit),
    tasks: new VaultEntityRepository<Task>(state, "task", taskSummary, audit),
    evidence: {
      getById: (id: string) => evidenceRepo.getById(id),
      list: () => evidenceRepo.list(),
      summaries: () => evidenceRepo.summaries(),
      update: () => {
        throw new DomainError(
          "EVIDENCE_IMMUTABLE",
          "Evidence records are append-only.",
          "Add a new evidence record (e.g. COUNTEREVIDENCE) instead of editing.",
          409,
        );
      },
      create: (record: EvidenceRecord, options: RepositoryWriteOptions) =>
        evidenceRepo.create({ ...record, version: 1, updatedAt: record.createdAt }, options),
    } satisfies EntityRepository<EvidenceRecord> as EntityRepository<EvidenceRecord>,
    proposals: new VaultEntityRepository<DecompositionProposal>(state, "proposal", proposalSummary, audit),
    audit,
    backup: new VaultBackupService(state),
  };
}
