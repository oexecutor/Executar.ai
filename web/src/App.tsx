import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";
import { getBrowserSession, restoreWorkspaceFromAppSession, selectedWorkspace, signOut } from "./auth";
import { Layout, type AppView } from "./components/Layout";
import { Login } from "./pages/Login";
import { Board } from "./pages/Board";
import { Documents } from "./pages/Documents";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { Today } from "./pages/Today";
import type { ProjectSummary } from "./types";

type Session = "checking" | "authenticated" | "anonymous";

export function App() {
  const [session, setSession] = useState<Session>("checking");
  const [view, setView] = useState<AppView>("overview");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => localStorage.getItem("executa.project"),
  );

  const loadProjects = useCallback(async () => {
    const list = await getJson<ProjectSummary[]>("/api/executar/projects");
    setProjects(list);
    setSelectedProjectId((current) => {
      if (current && list.some((project) => project.id === current)) return current;
      const next = list[0]?.id ?? null;
      if (next) localStorage.setItem("executa.project", next);
      else localStorage.removeItem("executa.project");
      return next;
    });
  }, []);

  const checkSession = useCallback(async () => {
    const appWorkspace = await restoreWorkspaceFromAppSession();
    if (!appWorkspace) {
      const browserSession = await getBrowserSession();
      if (!browserSession || !selectedWorkspace()) {
        setSession("anonymous");
        return;
      }
    }
    try {
      await loadProjects();
      setSession("authenticated");
    } catch {
      setSession("anonymous");
    }
  }, [loadProjects]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  function chooseProject(projectId: string) {
    localStorage.setItem("executa.project", projectId);
    setSelectedProjectId(projectId);
  }

  async function handleLogout() {
    await signOut();
    setProjects([]);
    setSelectedProjectId(null);
    setSession("anonymous");
  }

  if (session === "checking") {
    return (
      <main className="boot-screen">
        <span className="brand-mark"><i />EXECUTA.AI</span>
        <div className="boot-line"><i /></div>
        <p>Preparando seu workspace…</p>
      </main>
    );
  }

  if (session === "anonymous") {
    return <Login onSuccess={() => void checkSession()} />;
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const workspace = selectedWorkspace();

  return (
    <Layout
      active={view}
      onNavigate={setView}
      onLogout={() => void handleLogout()}
      projects={projects}
      selectedProjectId={selectedProjectId}
      onSelectProject={chooseProject}
      workspace={workspace}
    >
      {view === "overview" && (
        <Overview
          projects={projects}
          onOpenProject={(id) => {
            chooseProject(id);
            setView("project");
          }}
          onOpenPortfolio={() => setView("portfolio")}
        />
      )}
      {view === "today" && (
        <Today project={selectedProject} onOpenProject={() => setView("project")} />
      )}
      {view === "portfolio" && (
        <Portfolio
          projects={projects}
          onChanged={() => void loadProjects()}
          onOpenProject={(id) => {
            chooseProject(id);
            setView("project");
          }}
        />
      )}
      {view === "project" && (
        <ProjectWorkspace
          projectId={selectedProjectId}
          onChanged={() => void loadProjects()}
          onOpenPortfolio={() => setView("portfolio")}
        />
      )}
      {view === "board" && <Board project={selectedProject} />}
      {view === "documents" && <Documents project={selectedProject} />}
    </Layout>
  );
}
