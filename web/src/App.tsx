import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";
import { ensureWorkspaceSession, selectedWorkspace } from "./auth";
import { Layout, type AppView } from "./components/Layout";

import { Board } from "./pages/Board";
import { Documents } from "./pages/Documents";
import { Editorial } from "./pages/Editorial";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { Today } from "./pages/Today";
import type { ProjectSummary } from "./types";

type Session = "checking" | "ready" | "error";

function initialView(): AppView {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (params.get("start") === "ai" || params.get("start") === "import") return "portfolio";
  if (tab === "notes" || tab === "documents") return "documents";
  if (tab === "editorial") return "editorial";
  return "overview";
}

export function App() {
  const [session, setSession] = useState<Session>("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>(initialView);
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

  const openWorkspace = useCallback(async () => {
    setSession("checking");
    setSessionError(null);
    try {
      await ensureWorkspaceSession();
      await loadProjects();
      setSession("ready");
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : "Não foi possível abrir o workspace.");
      setSession("error");
    }
  }, [loadProjects]);

  useEffect(() => {
    void openWorkspace();
  }, [openWorkspace]);

  function chooseProject(projectId: string) {
    localStorage.setItem("executa.project", projectId);
    setSelectedProjectId(projectId);
  }

  if (session === "checking") {
    return (
      <main className="boot-screen">
        <span className="brand-mark"><i />EXECUTA.AI</span>
        <div className="boot-line"><i /></div>
        <p>Criando seu workspace gratuito…</p>
      </main>
    );
  }

  if (session === "error") {
    return (
      <main className="entry-session-error">
        <span className="brand-mark"><i />EXECUTA.AI</span>
        <p className="eyebrow">Não foi possível iniciar</p>
        <h1>Seu workspace não abriu.</h1>
        <p>{sessionError}</p>
        <div>
          <button className="button button-orange" type="button" onClick={() => void openWorkspace()}>
            Tentar novamente
          </button>
          <a className="button button-quiet" href="/">Voltar ao início</a>
        </div>
      </main>
    );
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const workspace = selectedWorkspace();

  return (
    <Layout
      active={view}
      onNavigate={setView}
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
      {view === "editorial" && <Editorial />}
    </Layout>
  );
}
