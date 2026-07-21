export type TaskStatus = "BACKLOG" | "READY" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  version: number;
  updatedAt: string;
}

export interface SprintSummary {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  wipLimit: number;
  version: number;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  sprintId: string | null;
  title: string;
  status: TaskStatus;
  priority: Priority;
  position: number;
  dominantDate: string | null;
  dueAt: string | null;
  blockedReason: string | null;
  stepsTotal: number;
  stepsDone: number;
  version: number;
}

export interface BoardColumn {
  status: TaskStatus;
  tasks: TaskSummary[];
}

export interface BoardView {
  sprint: { id: string; title: string; goal: string; status: string; wipLimit: number } | null;
  columns: BoardColumn[];
}

export interface TodayView {
  date: string;
  sprint: SprintSummary | null;
  dominantDelivery: TaskSummary | null;
  nextAction: TaskSummary | null;
  inProgress: TaskSummary[];
  ready: TaskSummary[];
  blocked: TaskSummary[];
  warnings: string[];
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  READY: "Pronta",
  IN_PROGRESS: "Em andamento",
  BLOCKED: "Bloqueada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const KANBAN_COLUMNS: TaskStatus[] = ["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE"];
