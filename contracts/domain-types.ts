export type ProjectStatus =
  | "IDEA"
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "ARCHIVED";

export type SprintStatus =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type TaskStatus =
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export type EpistemicType =
  | "FACT"
  | "EVIDENCE"
  | "INFERENCE"
  | "HYPOTHESIS"
  | "COUNTEREVIDENCE"
  | "GAP"
  | "DECISION";

export interface VersionedEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project extends VersionedEntity {
  workspaceId: string;
  title: string;
  objective: string;
  context: string;
  scopeIn: string[];
  scopeOut: string[];
  definitionOfDone: string[];
  status: ProjectStatus;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  noteRefs: string[];
  evidenceRefs: string[];
}

export interface TaskStep {
  id: string;
  title: string;
  status: "TODO" | "DOING" | "DONE";
}

export interface Task extends VersionedEntity {
  projectId: string;
  sprintId: string | null;
  title: string;
  outcome: string;
  acceptanceCriteria: string[];
  status: TaskStatus;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  position: number;
  steps: TaskStep[];
  dependencyIds: string[];
  blockedReason: string | null;
}

export interface RepositoryWriteOptions {
  actorId: string;
  requestId: string;
  idempotencyKey: string;
  expectedVersion?: number;
}

export interface ProjectRepository {
  getById(id: string): Promise<Project | null>;
  list(filter?: Record<string, unknown>): Promise<Project[]>;
  create(project: Project, options: RepositoryWriteOptions): Promise<Project>;
  update(
    id: string,
    patch: Partial<Project>,
    options: RepositoryWriteOptions,
  ): Promise<Project>;
}

export interface TaskRepository {
  getById(id: string): Promise<Task | null>;
  listBySprint(sprintId: string): Promise<Task[]>;
  create(task: Task, options: RepositoryWriteOptions): Promise<Task>;
  update(
    id: string,
    patch: Partial<Task>,
    options: RepositoryWriteOptions,
  ): Promise<Task>;
  move(
    id: string,
    targetStatus: TaskStatus,
    targetPosition: number,
    options: RepositoryWriteOptions,
  ): Promise<Task>;
}
