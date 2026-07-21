import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson, newIdempotencyKey, postJson } from "../api";
import { TaskForm } from "../components/TaskForm";
import type { BoardView, SprintSummary, TaskStatus, TaskSummary } from "../types";
import { KANBAN_COLUMNS, TASK_STATUS_LABEL } from "../types";

async function moveTask(task: TaskSummary, targetStatus: TaskStatus, targetPosition: number): Promise<void> {
  const body: Record<string, unknown> = {
    idempotency_key: newIdempotencyKey(),
    target_status: targetStatus,
    target_position: targetPosition,
    expected_version: task.version,
  };
  if (targetStatus === "BLOCKED") {
    const reason = window.prompt("Por que esta tarefa está bloqueada?");
    if (!reason) return;
    body.blocked_reason = reason;
  }
  if (targetStatus === "DONE") {
    const evidence = window.prompt("Evidência de conclusão (ou deixe em branco para justificar sem evidência):");
    if (evidence) body.completion_evidence = [evidence];
    else {
      const override = window.prompt("Sem evidência — explique por que está concluída mesmo assim:");
      if (!override) return;
      body.override_reason = override;
    }
  }
  await postJson(`/api/pm/tasks/${task.id}/move`, body);
}

function TaskCard({ task, onChanged, onEdit }: { task: TaskSummary; onChanged: () => void; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function handleMove(event: React.ChangeEvent<HTMLSelectElement>) {
    const target = event.target.value as TaskStatus;
    if (target === task.status) return;
    setError(null);
    try {
      await moveTask(task, target, 0);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao mover a tarefa.");
    }
  }

  return (
    <li className="task-card">
      <p className="task-card-title">{task.title}</p>
      <p className="task-card-meta">
        {task.priority}
        {task.stepsTotal > 0 ? ` · ${task.stepsDone}/${task.stepsTotal} passos` : ""}
      </p>
      {task.blockedReason && <p className="task-card-blocked">Bloqueada: {task.blockedReason}</p>}
      <div className="task-card-actions">
        <label className="visually-hidden" htmlFor={`move-${task.id}`}>
          Mover {task.title} para
        </label>
        <select id={`move-${task.id}`} value={task.status} onChange={handleMove}>
          {KANBAN_COLUMNS.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <button type="button" className="button secondary small" onClick={onEdit}>
          Editar
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </li>
  );
}

export function Board() {
  const [sprint, setSprint] = useState<SprintSummary | null>(null);
  const [board, setBoard] = useState<BoardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formTask, setFormTask] = useState<TaskSummary | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getJson<SprintSummary | null>("/api/pm/sprints/current");
      setSprint(current);
      if (current) {
        const boardView = await getJson<BoardView>(`/api/pm/sprints/${current.id}/board`);
        setBoard(boardView);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o sprint.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="lead">Carregando…</p>;
  if (error) return <p role="alert" className="form-error">{error}</p>;
  if (!sprint || !board) return <p className="lead">Crie um projeto em Hoje para começar um sprint.</p>;

  return (
    <section aria-labelledby="board-heading">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{sprint.status}</div>
          <h1 id="board-heading">{sprint.title}</h1>
          <p className="lead">{sprint.goal}</p>
        </div>
        <button type="button" className="button" onClick={() => setFormTask("new")}>
          + Nova tarefa
        </button>
      </div>

      <div className="board-columns">
        {board.columns.map((column) => (
          <div className="board-column" key={column.status}>
            <h2>
              {TASK_STATUS_LABEL[column.status]} <span className="column-count">{column.tasks.length}</span>
            </h2>
            <ul className="task-card-list">
              {column.tasks.map((task) => (
                <TaskCard key={task.id} task={task} onChanged={load} onEdit={() => setFormTask(task)} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {formTask && (
        <TaskForm
          projectId={sprint.projectId}
          sprintId={sprint.id}
          task={formTask === "new" ? undefined : formTask}
          onCancel={() => setFormTask(null)}
          onSaved={() => {
            setFormTask(null);
            load();
          }}
        />
      )}
    </section>
  );
}
