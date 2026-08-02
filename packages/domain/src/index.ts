export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['PENDING', 'READY', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const QR_INTENTS = ['START', 'CONTINUE', 'STATUS', 'COMPLETE', 'RECYCLE'] as const;
export type QrIntent = (typeof QR_INTENTS)[number];

export const QR_STATUSES = ['ACTIVE', 'USED', 'REVOKED', 'EXPIRED'] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

export const EVIDENCE_KINDS = ['NOTE', 'PHOTO', 'FILE', 'LINK', 'QR_RECYCLE'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  updatedAt: string;
}

export interface TaskStep {
  id: string;
  taskId: string;
  position: 1 | 2 | 3;
  title: string;
  isDone: boolean;
  completedAt: string | null;
}

export interface CurrentTask {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  steps: TaskStep[];
}

export interface CurrentPosition {
  project: ProjectSummary;
  task: CurrentTask | null;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
}

export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export function nextTaskStatus(steps: readonly Pick<TaskStep, 'isDone'>[]): TaskStatus {
  if (steps.length > 0 && steps.every((step) => step.isDone)) return 'DONE';
  if (steps.some((step) => step.isDone)) return 'IN_PROGRESS';
  return 'READY';
}

export interface QrResolution {
  token: string;
  workspaceId: string;
  projectId: string;
  taskId: string | null;
  taskReference: string | null;
  taskTitle: string | null;
  currentStatus: TaskStatus | null;
  intent: QrIntent;
  targetStatus: TaskStatus | null;
  requiresConfirmation: boolean;
  status: QrStatus;
  expiresAt: string | null;
}
