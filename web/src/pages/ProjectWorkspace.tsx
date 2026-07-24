import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  LayoutList,
  Rows3,
  Table2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getJson, postJson } from "../api";
import type { ProjectArea, ProjectBundle, ProjectItem } from "../types";

interface ProjectWorkspaceProps {
  projectId: string | null;
  onChanged: () => void;
  onOpenPortfolio: () => void;
}

type PlanView = "plan" | "list" | "table";

export function ProjectWorkspace({ projectId, onChanged, onOpenPortfolio }: ProjectWorkspaceProps) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [view, setView] = useState<PlanView>("plan");
  const [phase, setPhase] = useState("F1");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setBundle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBundle(await getJson<ProjectBundle>(`/api/executar/projects/${projectId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o projeto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleAreas = useMemo(() => {
    if (!bundle) return [];
    const areaIds = bundle.project.phases.find((candidate) => candidate.id === phase)?.areas ?? [];
    return bundle.project.areas.filter((area) => areaIds.includes(area.id));
  }, [bundle, phase]);

  async function toggleAction(actionId: string) {
    if (!bundle || !projectId) return;
    setPendingId(actionId);
    setError(null);
    try {
      await postJson(`/api/executar/projects/${projectId}/actions/${actionId}`, {
        done: bundle.progress[actionId] !== true,
      });
      await load();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a ação.");
    } finally {
      setPendingId(null);
    }
  }

  async function toggleCheckpoint(item: ProjectItem) {
    if (!bundle || !projectId) return;
    setPendingId(item.id);
    setError(null);
    try {
      await postJson(`/api/executar/projects/${projectId}/checkpoints/${item.id}`, {
        done: bundle.progress[item.id] !== true,
      });
      await load();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível validar o checkpoint.");
    } finally {
      setPendingId(null);
    }
  }

  async function exportProject() {
    if (!projectId || !bundle) return;
    const payload = await getJson(`/api/executar/projects/${projectId}/export`);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectId}-executa-package.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingProject />;
  if (!projectId || !bundle) {
    return (
      <div className="empty-command">
        <span>3·9·36</span>
        <h2>Selecione um projeto.</h2>
        <p>O workspace apresenta fases, áreas, ações e checkpoints de um projeto por vez.</p>
        <button className="button button-orange" type="button" onClick={onOpenPortfolio}>Abrir portfólio</button>
      </div>
    );
  }

  const { project, progress, status } = bundle;

  return (
    <section className="project-page">
      <button className="back-link" type="button" onClick={onOpenPortfolio}><ArrowLeft size={15} /> Portfólio</button>
      <header className="project-heading">
        <div>
          <div className="project-kicker"><span>{project.meta.id}</span><i />CANÔNICO 3–9–36</div>
          <h1>{project.meta.name}</h1>
          <p>{project.meta.description}</p>
        </div>
        <button className="button button-quiet" type="button" onClick={() => void exportProject()}>
          <Download size={17} /> Exportar
        </button>
      </header>

      <div className="project-status-strip">
        <article><span>Progresso</span><strong>{status.actions.pct}%</strong></article>
        <article><span>Ações</span><strong>{status.actions.done}<small>/{status.actions.total}</small></strong></article>
        <article><span>Tarefas</span><strong>{status.items.tasks.done}<small>/{status.items.tasks.total}</small></strong></article>
        <article><span>Checkpoints</span><strong>{status.items.checkpoints.done}<small>/{status.items.checkpoints.total}</small></strong></article>
        <div className="status-progress"><i style={{ width: `${status.actions.pct}%` }} /></div>
      </div>

      <div className="project-controls">
        <div className="phase-tabs" role="tablist" aria-label="Fases">
          {project.phases.map((candidate) => (
            <button
              type="button"
              role="tab"
              aria-selected={phase === candidate.id}
              key={candidate.id}
              onClick={() => setPhase(candidate.id)}
            >
              <span>{candidate.id}</span>{candidate.title}
              <small>{status.phases.find((item) => item.id === candidate.id)?.pct ?? 0}%</small>
            </button>
          ))}
        </div>
        <div className="view-tabs" aria-label="Visualização">
          <button type="button" aria-pressed={view === "plan"} onClick={() => setView("plan")}><Rows3 size={16} /> Plano</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList size={16} /> Lista</button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 size={16} /> Tabela</button>
        </div>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}

      {view === "plan" && (
        <div className="area-stack">
          {visibleAreas.map((area) => (
            <AreaPlan
              key={area.id}
              area={area}
              progress={progress}
              pendingId={pendingId}
              onToggleAction={toggleAction}
              onToggleCheckpoint={toggleCheckpoint}
            />
          ))}
        </div>
      )}
      {view === "list" && <ItemList areas={visibleAreas} progress={progress} onToggleAction={toggleAction} />}
      {view === "table" && <ItemTable areas={visibleAreas} progress={progress} />}
    </section>
  );
}

function AreaPlan({
  area,
  progress,
  pendingId,
  onToggleAction,
  onToggleCheckpoint,
}: {
  area: ProjectArea;
  progress: Record<string, boolean>;
  pendingId: string | null;
  onToggleAction: (id: string) => Promise<void>;
  onToggleCheckpoint: (item: ProjectItem) => Promise<void>;
}) {
  const tasks = area.items.filter((item) => item.type === "task");
  const checkpoint = area.items.find((item) => item.type === "checkpoint");
  const actions = tasks.flatMap((task) => task.actions ?? []);
  const done = actions.filter((action) => progress[action.id]).length;

  return (
    <details className="area-card" open>
      <summary>
        <span className="area-index">{area.id}</span>
        <div><strong>{area.title}</strong><small>{done}/{actions.length} ações concluídas</small></div>
        <div className="area-progress"><i style={{ width: `${actions.length ? (done / actions.length) * 100 : 0}%` }} /></div>
        <ChevronDown size={18} />
      </summary>
      <div className="area-content">
        {tasks.map((task) => (
          <article className="method-task" key={task.id}>
            <div className="task-identity">
              <span>{task.id}</span>
              <div><h3>{task.title}</h3><p>{task.evidence}</p></div>
            </div>
            <div className="action-list">
              {(task.actions ?? []).map((action) => {
                const checked = progress[action.id] === true;
                return (
                  <button
                    type="button"
                    className={checked ? "action-row is-done" : "action-row"}
                    key={action.id}
                    onClick={() => void onToggleAction(action.id)}
                    disabled={pendingId === action.id}
                  >
                    <i>{checked && <Check size={14} />}</i>
                    <span><strong>{action.title}</strong><small>{action.stop_condition}</small></span>
                    <em>{action.id}</em>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
        {checkpoint && (
          <button
            type="button"
            className={progress[checkpoint.id] ? "checkpoint-row is-done" : "checkpoint-row"}
            onClick={() => void onToggleCheckpoint(checkpoint)}
            disabled={pendingId === checkpoint.id}
          >
            <i><CheckCircle2 size={20} /></i>
            <span><small>CHECKPOINT · {checkpoint.id}</small><strong>{checkpoint.title}</strong><em>{checkpoint.evidence}</em></span>
            <b>{progress[checkpoint.id] ? "VALIDADO" : "VALIDAR"}</b>
          </button>
        )}
      </div>
    </details>
  );
}

function ItemList({
  areas,
  progress,
  onToggleAction,
}: {
  areas: ProjectArea[];
  progress: Record<string, boolean>;
  onToggleAction: (id: string) => Promise<void>;
}) {
  return (
    <div className="flat-list">
      {areas.flatMap((area) => area.items.filter((item) => item.type === "task").map((item) => (
        <article key={item.id}>
          <span>{item.id}</span>
          <div><small>{area.short_title}</small><strong>{item.title}</strong></div>
          <div className="mini-actions">
            {(item.actions ?? []).map((action) => (
              <button
                type="button"
                key={action.id}
                className={progress[action.id] ? "is-done" : ""}
                onClick={() => void onToggleAction(action.id)}
                aria-label={`${progress[action.id] ? "Reabrir" : "Concluir"} ${action.title}`}
              >
                {progress[action.id] ? <Check size={13} /> : action.id.split(".").at(-1)}
              </button>
            ))}
          </div>
          <b>{(item.actions ?? []).every((action) => progress[action.id]) ? "Concluída" : "Em execução"}</b>
        </article>
      )))}
    </div>
  );
}

function ItemTable({ areas, progress }: { areas: ProjectArea[]; progress: Record<string, boolean> }) {
  const tasks = areas.flatMap((area) => area.items.filter((item) => item.type === "task").map((item) => ({ area, item })));
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr><th>ID</th><th>Área</th><th>Tarefa</th><th>Responsável</th><th>Ações</th><th>Estado</th></tr></thead>
        <tbody>
          {tasks.map(({ area, item }) => {
            const actions = item.actions ?? [];
            const done = actions.filter((action) => progress[action.id]).length;
            return (
              <tr key={item.id}>
                <td><code>{item.id}</code></td>
                <td>{area.short_title}</td>
                <td><strong>{item.title}</strong></td>
                <td>{item.owner ?? "—"}</td>
                <td>{done}/{actions.length}</td>
                <td><span className={done === actions.length ? "status-done" : done ? "status-progressing" : "status-ready"}>{done === actions.length ? "Concluída" : done ? "Em andamento" : "Pronta"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoadingProject() {
  return <div className="project-loading"><div><i /><i /><i /></div><p>Carregando estrutura canônica…</p></div>;
}
