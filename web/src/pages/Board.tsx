import { Check, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "../api";
import type { ProjectBundle, ProjectItem, ProjectSummary } from "../types";

type Column = "READY" | "IN_PROGRESS" | "CHECKPOINT" | "DONE";

export function Board({ project }: { project: ProjectSummary | null }) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!project) return;
    try {
      setBundle(await getJson<ProjectBundle>(`/api/executar/projects/${project.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o Kanban.");
    }
  }, [project]);

  useEffect(() => { void load(); }, [load]);

  const cards = useMemo(() => {
    if (!bundle) return [] as Array<{ item: ProjectItem; areaTitle: string; column: Column; done: number; total: number }>;
    return bundle.project.areas.flatMap((area) => area.items.map((item) => {
      const actions = item.actions ?? [];
      const done = actions.filter((action) => bundle.progress[action.id]).length;
      const column: Column = item.type === "checkpoint"
        ? bundle.progress[item.id] ? "DONE" : "CHECKPOINT"
        : done === actions.length ? "DONE" : done > 0 ? "IN_PROGRESS" : "READY";
      return { item, areaTitle: area.short_title, column, done, total: actions.length };
    }));
  }, [bundle]);

  async function advance(item: ProjectItem) {
    if (!project || !bundle) return;
    setPending(item.id);
    setError(null);
    try {
      if (item.type === "checkpoint") {
        await postJson(`/api/executar/projects/${project.id}/checkpoints/${item.id}`, { done: true });
      } else {
        const next = (item.actions ?? []).find((action) => !bundle.progress[action.id]);
        if (next) await postJson(`/api/executar/projects/${project.id}/actions/${next.id}`, { done: true });
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível avançar o item.");
    } finally {
      setPending(null);
    }
  }

  if (!project) return <div className="empty-command"><span>KANBAN</span><h2>Selecione um projeto.</h2><p>O quadro é derivado da mesma estrutura 3–9–36.</p></div>;

  const columns: Array<{ id: Column; label: string }> = [
    { id: "READY", label: "Prontas" },
    { id: "IN_PROGRESS", label: "Em andamento" },
    { id: "CHECKPOINT", label: "Checkpoints" },
    { id: "DONE", label: "Concluídas" },
  ];

  return (
    <section className="board-page">
      <header className="page-title-row">
        <div><p className="eyebrow">Kanban canônico</p><h1>Fluxo visível.</h1><p>{project.name}</p></div>
        <span className="board-rule">O estado é derivado das ações</span>
      </header>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="kanban">
        {columns.map((column) => {
          const items = cards.filter((card) => card.column === column.id);
          return (
            <section className="kanban-column" key={column.id}>
              <header><span>{column.label}</span><b>{items.length}</b></header>
              <div>
                {items.map((card) => (
                  <article className={`kanban-card card-${column.id.toLowerCase()}`} key={card.item.id}>
                    <div className="kanban-card-top"><span>{card.item.id}</span><small>{card.areaTitle}</small></div>
                    <h2>{card.item.title}</h2>
                    <p>{card.item.evidence}</p>
                    {card.item.type === "task" && <div className="card-action-progress">{Array.from({ length: card.total }, (_, index) => <i key={index} className={index < card.done ? "done" : ""} />)}</div>}
                    {column.id !== "DONE" && (
                      <button type="button" onClick={() => void advance(card.item)} disabled={pending === card.item.id}>
                        {card.item.type === "checkpoint" ? "Validar" : "Concluir próxima"} <ChevronRight size={15} />
                      </button>
                    )}
                    {column.id === "DONE" && <span className="card-done"><Check size={14} /> Concluída</span>}
                  </article>
                ))}
                {!items.length && <p className="column-empty">Nenhum item.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
