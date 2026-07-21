import { useState, type FormEvent } from "react";
import { newIdempotencyKey, postJson } from "../api";
import type { ProjectSummary, SprintSummary } from "../types";

interface FirstProjectSetupProps {
  onReady: () => void;
}

/**
 * First-run bootstrap: creates a project and its first sprint (default
 * length per contracts/domain-model.yaml defaults.sprint_days=5) so Today
 * and the board have something to show. This is the only place task
 * creation is preceded by project/sprint creation in the UI.
 */
export function FirstProjectSetup({ onReady }: FirstProjectSetupProps) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !objective.trim() || !definitionOfDone.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setSubmitting(true);
    try {
      const project = await postJson<ProjectSummary>("/api/pm/projects", {
        idempotency_key: newIdempotencyKey(),
        title: title.trim(),
        objective: objective.trim(),
        definitionOfDone: [definitionOfDone.trim()],
      });
      const start = new Date();
      const end = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
      const isoDate = (date: Date) => date.toISOString().slice(0, 10);
      await postJson<SprintSummary>("/api/pm/sprints", {
        idempotency_key: newIdempotencyKey(),
        projectId: project.id,
        title: "Sprint atual",
        goal: objective.trim(),
        startDate: isoDate(start),
        endDate: isoDate(end),
      });
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar o projeto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="setup-heading">
      <h1 id="setup-heading">Comece um projeto</h1>
      <p className="lead">Ainda não há um projeto ativo. Crie o primeiro para ver Hoje e o Sprint.</p>
      <form onSubmit={handleSubmit} className="stacked-form">
        <label htmlFor="setup-title">Título do projeto</label>
        <input id="setup-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-required="true" autoFocus />

        <label htmlFor="setup-objective">Objetivo</label>
        <input id="setup-objective" value={objective} onChange={(event) => setObjective(event.target.value)} aria-required="true" />

        <label htmlFor="setup-dod">Definição de pronto</label>
        <input
          id="setup-dod"
          value={definitionOfDone}
          onChange={(event) => setDefinitionOfDone(event.target.value)}
          placeholder="Como você sabe que este projeto terminou?"
          aria-required="true"
        />

        <p role="alert" className="form-error">
          {error}
        </p>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Criando…" : "Criar projeto"}
        </button>
      </form>
    </section>
  );
}
