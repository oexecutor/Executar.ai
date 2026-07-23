import { ArrowRight, CheckCircle2, CircleDot, Plus } from "lucide-react";
import type { ProjectSummary } from "../types";

interface OverviewProps {
  projects: ProjectSummary[];
  onOpenProject: (id: string) => void;
  onOpenPortfolio: () => void;
}

export function Overview({ projects, onOpenProject, onOpenPortfolio }: OverviewProps) {
  const totalActions = projects.reduce((sum, project) => sum + project.actionsTotal, 0);
  const doneActions = projects.reduce((sum, project) => sum + project.actionsDone, 0);
  const overall = totalActions ? Math.round((doneActions / totalActions) * 100) : 0;
  const leading = projects[0] ?? null;

  return (
    <section className="overview-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>Execução em foco.</h1>
          <p>A próxima decisão relevante, sem ruído ao redor.</p>
        </div>
        <button className="button button-dark" type="button" onClick={onOpenPortfolio}>
          <Plus size={17} /> Novo projeto
        </button>
      </header>

      {!leading ? (
        <div className="empty-command">
          <span>00</span>
          <h2>Seu primeiro projeto começa com contexto.</h2>
          <p>Descreva o resultado desejado e receba a estrutura completa de 3 fases, 9 áreas e 36 itens.</p>
          <button className="button button-orange" type="button" onClick={onOpenPortfolio}>
            Estruturar projeto <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="overview-grid">
            <article className="metric-card metric-primary">
              <span>Progresso global</span>
              <strong>{overall}<small>%</small></strong>
              <div className="metric-progress"><i style={{ width: `${overall}%` }} /></div>
              <p>{doneActions} de {totalActions} ações concluídas</p>
            </article>
            <article className="metric-card">
              <span>Projetos ativos</span>
              <strong>{projects.length}</strong>
              <p>Todos no mesmo workspace</p>
            </article>
            <article className="metric-card">
              <span>Ações restantes</span>
              <strong>{Math.max(totalActions - doneActions, 0)}</strong>
              <p>Ordenadas por fase e área</p>
            </article>
          </div>

          <article className="focus-project">
            <div className="focus-index">
              <span>PROJETO EM FOCO</span>
              <strong>{leading.id}</strong>
            </div>
            <div className="focus-main">
              <p className="eyebrow eyebrow-orange">Entrega dominante</p>
              <h2>{leading.name}</h2>
              <p>{leading.description}</p>
              <div className="focus-progress">
                <div><i style={{ width: `${leading.progressPct}%` }} /></div>
                <strong>{leading.progressPct}%</strong>
              </div>
            </div>
            <button type="button" onClick={() => onOpenProject(leading.id)} aria-label={`Abrir ${leading.name}`}>
              <ArrowRight size={24} />
            </button>
          </article>

          <div className="execution-principles">
            <article><CircleDot size={18} /><div><strong>Uma próxima ação</strong><span>O sistema aponta o item atual.</span></div></article>
            <article><CheckCircle2 size={18} /><div><strong>Evidência antes de status</strong><span>Conclusão exige critério verificável.</span></div></article>
            <article><ArrowRight size={18} /><div><strong>Cloud e app sincronizados</strong><span>O MCP opera a mesma estrutura.</span></div></article>
          </div>
        </>
      )}
    </section>
  );
}
