import { useState, type FormEvent } from "react";
import { newIdempotencyKey, patchJson, postJson } from "../api";
import type { Priority, TaskSummary } from "../types";

interface TaskFormProps {
  projectId: string;
  sprintId: string;
  task?: TaskSummary & { outcome?: string };
  onSaved: () => void;
  onCancel: () => void;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function TaskForm({ projectId, sprintId, task, onSaved, onCancel }: TaskFormProps) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [outcome, setOutcome] = useState(task?.outcome ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [steps, setSteps] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Título é obrigatório.");
      return;
    }
    if (!isEdit && !outcome.trim()) {
      setError("Resultado observável é obrigatório.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && task) {
        await patchJson(`/api/pm/tasks/${task.id}`, {
          idempotency_key: newIdempotencyKey(),
          expected_version: task.version,
          patch: { title: title.trim(), priority },
        });
      } else {
        await postJson("/api/pm/tasks", {
          idempotency_key: newIdempotencyKey(),
          projectId,
          sprintId,
          title: title.trim(),
          outcome: outcome.trim(),
          priority,
          steps: steps.filter((step) => step.trim()).map((step) => ({ title: step.trim() })),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a tarefa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="modal task-form"
        aria-labelledby="task-form-heading"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="task-form-heading">{isEdit ? "Editar tarefa" : "Nova tarefa"}</h2>

        <label htmlFor="task-title">Título</label>
        <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-required="true" autoFocus />

        {!isEdit && (
          <>
            <label htmlFor="task-outcome">Resultado observável</label>
            <input
              id="task-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              placeholder="O que muda quando esta tarefa termina?"
              aria-required="true"
            />
          </>
        )}

        <label htmlFor="task-priority">Prioridade</label>
        <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        {!isEdit && (
          <fieldset className="steps-fieldset">
            <legend>Passos (até 3, opcional)</legend>
            {steps.map((step, index) => (
              <input
                key={index}
                aria-label={`Passo ${index + 1}`}
                value={step}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = event.target.value;
                  setSteps(next);
                }}
                placeholder={`Passo ${index + 1}`}
              />
            ))}
          </fieldset>
        )}

        <p role="alert" className="form-error">
          {error}
        </p>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
