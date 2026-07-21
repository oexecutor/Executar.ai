import { useCallback, useEffect, useState } from "react";
import { getJson } from "../api";
import { FirstProjectSetup } from "../components/FirstProjectSetup";
import type { TaskSummary, TodayView } from "../types";
import { TASK_STATUS_LABEL } from "../types";

interface TodayProps {
  onOpenBoard: () => void;
}

function TaskLine({ task }: { task: TaskSummary }) {
  return (
    <li className="task-line">
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {TASK_STATUS_LABEL[task.status]}
        {task.stepsTotal > 0 ? ` · ${task.stepsDone}/${task.stepsTotal} passos` : ""}
      </span>
    </li>
  );
}

export function Today({ onOpenBoard }: TodayProps) {
  const [today, setToday] = useState<TodayView | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const view = await getJson<TodayView>("/api/pm/today");
      setNeedsSetup(view.sprint === null);
      setToday(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar Hoje.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="lead">Carregando…</p>;
  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (needsSetup || !today) return <FirstProjectSetup onReady={load} />;

  return (
    <section aria-labelledby="today-heading">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{today.date}</div>
          <h1 id="today-heading">Hoje</h1>
        </div>
        <button type="button" className="button" onClick={onOpenBoard}>
          Ver Sprint
        </button>
      </div>

      {today.warnings.map((warning) => (
        <p key={warning} className="warning-banner" role="status">
          {warning}
        </p>
      ))}

      <div className="panel dominant-panel">
        <h2>Entrega dominante do dia</h2>
        {today.dominantDelivery ? (
          <p className="dominant-title">{today.dominantDelivery.title}</p>
        ) : (
          <p className="lead">Nenhuma entrega dominante marcada para hoje.</p>
        )}
      </div>

      <div className="panel">
        <h2>Próxima ação</h2>
        {today.nextAction ? (
          <p className="dominant-title">{today.nextAction.title}</p>
        ) : (
          <p className="lead">Nada pronto para começar agora. Veja o Sprint.</p>
        )}
      </div>

      <div className="today-columns">
        <div className="panel">
          <h2>Em andamento ({today.inProgress.length})</h2>
          <ul className="task-list">
            {today.inProgress.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>Bloqueadas ({today.blocked.length})</h2>
          <ul className="task-list">
            {today.blocked.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
