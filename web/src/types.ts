export type ItemType = "checkpoint" | "task";

export interface ProjectAction {
  id: string;
  title: string;
  stop_condition: string;
}

export interface ProjectItem {
  id: string;
  type: ItemType;
  title: string;
  owner?: string;
  evidence?: string;
  predecessors?: string[];
  actions?: ProjectAction[];
}

export interface ProjectArea {
  id: string;
  title: string;
  short_title: string;
  items: ProjectItem[];
}

export interface CanonicalProject {
  meta: {
    id: string;
    name: string;
    description: string;
    owner?: string;
    created_at?: string;
    updated_at?: string;
  };
  phases: Array<{ id: "F1" | "F2" | "F3"; title: string; areas: string[] }>;
  areas: ProjectArea[];
  final_deliverables: Array<{
    id: string;
    title: string;
    description: string;
    linked_areas: string[];
  }>;
}

export type ProgressState = Record<string, boolean>;

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  owner: string | null;
  progressPct: number;
  actionsDone: number;
  actionsTotal: number;
  updatedAt: string | null;
}

export interface ProjectStatus {
  actions: { total: number; done: number; pending: number; pct: number };
  items: {
    total: number;
    done: number;
    pending: number;
    checkpoints: { total: number; done: number };
    tasks: { total: number; done: number };
  };
  phases: Array<{ id: string; title: string; total: number; done: number; pending: number; pct: number }>;
  deliverables: Array<{ id: string; title: string; description: string; linkedAreas: string[]; pct: number }>;
  current: {
    areaId: string;
    areaTitle: string;
    itemId: string;
    itemTitle: string;
    itemType: ItemType;
    action: { id: string; title: string; done: boolean } | null;
  } | null;
}

export interface ProjectBundle {
  project: CanonicalProject;
  progress: ProgressState;
  status: ProjectStatus;
}

export interface NextItem {
  id: string;
  title: string;
  type: ItemType;
  areaId: string;
  areaTitle: string;
  owner: string | null;
  evidence: string | null;
  actions: Array<{ id: string; title: string; done: boolean }>;
}

export interface VaultEntry {
  path: string;
  name: string;
  extension: string;
  isNote: boolean;
  isText: boolean;
  editable: boolean;
  sizeBytes: number;
  modifiedAt: string;
  sha256: string;
  viewUrl: string;
  downloadUrl: string;
}
