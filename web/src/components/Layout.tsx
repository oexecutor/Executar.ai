import {
  CalendarCheck2,
  ChevronDown,
  FileText,
  FolderKanban,
  Gauge,
  LayoutGrid,
  LogOut,
  PanelsTopLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceMembership } from "../auth";
import type { ProjectSummary } from "../types";

export type AppView = "overview" | "today" | "portfolio" | "project" | "board" | "documents";

interface LayoutProps {
  active: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  workspace: WorkspaceMembership | null;
  children: ReactNode;
}

const NAV: Array<{ id: AppView; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "today", label: "Hoje", icon: CalendarCheck2 },
  { id: "portfolio", label: "Portfólio", icon: LayoutGrid },
  { id: "project", label: "Projeto", icon: PanelsTopLeft },
  { id: "board", label: "Kanban", icon: FolderKanban },
  { id: "documents", label: "Documentos", icon: FileText },
];

export function Layout({
  active,
  onNavigate,
  onLogout,
  projects,
  selectedProjectId,
  onSelectProject,
  workspace,
  children,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark brand-inverse"><i />EXECUTA.AI</span>
          <span className="sidebar-version">PWA / 04</span>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-current={active === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="workspace-identity">
            <i>{workspace?.workspaceName?.slice(0, 1).toUpperCase() ?? "W"}</i>
            <span>
              <strong>{workspace?.workspaceName ?? "Workspace"}</strong>
              <small>{workspace?.role ?? "MEMBRO"}</small>
            </span>
          </div>
          <button className="logout-button" type="button" onClick={onLogout} aria-label="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="app-stage">
        <header className="app-topbar">
          <div className="project-switcher">
            <label htmlFor="project-switch">Projeto ativo</label>
            <div>
              <select
                id="project-switch"
                value={selectedProjectId ?? ""}
                onChange={(event) => event.target.value && onSelectProject(event.target.value)}
                disabled={!projects.length}
              >
                {!projects.length && <option value="">Nenhum projeto</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
          </div>
          <span className="connection-state"><i /> Supabase conectado</span>
        </header>
        <main className="app-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}
