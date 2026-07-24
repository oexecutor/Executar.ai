export interface ProjectAction {
  id: string;
  title: string;
  stop_condition: string;
}

export interface ProjectItem {
  id: string;
  type: "checkpoint" | "task";
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

export interface ProjectPhase {
  id: "F1" | "F2" | "F3";
  title: string;
  areas: string[];
}

export interface FinalDeliverable {
  id: string;
  title: string;
  description: string;
  linked_areas: string[];
}

export interface ProjectDoc {
  meta: {
    id: string;
    name: string;
    description: string;
    owner?: string;
    created_at?: string;
    updated_at?: string;
  };
  phases: ProjectPhase[];
  areas: ProjectArea[];
  final_deliverables: FinalDeliverable[];
}

export interface ProgressState {
  [actionOrCheckpointId: string]: boolean;
}

export interface EngineAction {
  id: string;
  title: string;
  done: boolean;
}

export interface EngineItem {
  id: string;
  title: string;
  type: "checkpoint" | "task";
  actions: EngineAction[];
  predecessors?: string[];
  done: boolean;
}

export interface EngineArea {
  id: string;
  title: string;
  shortTitle: string;
  items: EngineItem[];
}

export interface ExecutarProjectSummary {
  id: string;
  name: string;
  description: string;
  owner: string | null;
  progressPct: number;
  actionsDone: number;
  actionsTotal: number;
  updatedAt: string | null;
}
