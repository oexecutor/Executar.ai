import { ArrowRight, Check, CircleAlert, Focus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";
import type { NextItem, ProjectStatus, ProjectSummary } from "../types";

interface TodayProps {
  project: ProjectSummary | null;
  onOpenProject: () => void;
}

export function Today({ project, onOpenProject }: TodayProps) {
  const [items, setItems] = useState<NextItem[]>([]);
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!project) return;
    setError(null);
    try {
      const [next, currentStatus] = await Promise.all([
        getJson<{ next: NextItem[] }>(`/api/executar/projects/${project.id}/next?max=6`),
        getJson<ProjectStatus>(`/api/executar/projects/${project.id}/status`),
      ]);
      setItems(next.next);
      setStatus(currentStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar Hoje.");
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeCurrent() {
    const current = items[0]?.actions.find((action) => !action.done);
    if (!project || !current) return;
    setPending(true);
    try {
      await postJson(`/api/executar/projects/${project.id}/actions/${current.id}`, { done: true });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação.");
    } finally {
      setPending(false);
    }
  }

  if (!project) return <NoProject onOpenProject={onOpenProject} />;
  const current = items[0] ?? null;
  const currentAction = current?.actions.find((action) => !action.done) ?? null;

  return (
    <section className="today-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</p>
          <h1>Hoje.</h1>
          <p>Uma ação por vez. O restante continua organizado.</p>
        </div>
        <span className="today-score"><strong>{status?.actions.pct ?? project.progressPct}%</strong> do projeto</span>
      </header>

      {error && <p className="inline-error" role="alert">{error}</p>}

      <article className="dominant-action">
        <div className="dominant-label"><Focus size={17} /><span>ENTREGA DOMINANTE</span></div>
        {current ? (
          <>
            <p>{current.areaId} · {current.areaTitle}</p>
            <h2>{currentAction?.title ?? current.title}</h2>
            <blockquote>{current.evidence ?? "Conclua com uma evidência verificável."}</blockquote>
            <div className="dominant-actions">
              {currentAction ? (
                <button className="button button-orange" type="button" disabled={pending} onClick={() => void completeCurrent()}>
                  <Check size={18} /> {pending ? "Atualizando…" : "Marcar ação como concluída"}
                </button>
              ) : (
                <button className="button button-dark" type="button" onClick={onOpenProject}>Abrir checkpoint <ArrowRight size={17} /></button>
              )}
              <button className="button button-quiet" type="button" onClick={onOpenProject}>Ver no projeto</button>
            </div>
          </>
        ) : (
          <div className="all-done"><Check size={28} /><h2>Projeto concluído.</h2><p>Todos os itens estão validados.</p></div>
        )}
      </article>

      <div className="today-queue">
        <div className="queue-head"><span>Fila de execução</span><small>PRÓXIMOS {Math.max(items.length - 1, 0)}</small></div>
        {items.slice(1).map((item, index) => (
          <article key={item.id}>
            <span>{String(index + 2).padStart(2, "0")}</span>
            <div><small>{item.areaId} · {item.areaTitle}</small><strong>{item.title}</strong></div>
            <em>{item.type === "checkpoint" ? "CHECKPOINT" : `${item.actions.filter((action) => action.done).length}/${item.actions.length} AÇÕES`}</em>
          </article>
        ))}
        {items.length <= 1 && <p className="queue-empty">Nenhum outro item na fila.</p>}
      </div>

      <div className="focus-rule"><CircleAlert size={18} /><p><strong>Regra de foco:</strong> conclua ou bloqueie a ação atual antes de puxar a próxima.</p></div>
    </section>
  );
}

function NoProject({ onOpenProject }: { onOpenProject: () => void }) {
  return <div className="empty-command"><span>HOJE</span><h2>Nenhum projeto selecionado.</h2><p>Escolha um projeto para receber sua próxima ação.</p><button className="button button-orange" type="button" onClick={onOpenProject}>Abrir projetos</button></div>;
}
