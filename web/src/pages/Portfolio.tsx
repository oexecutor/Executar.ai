import { ArrowRight, FileJson, Plus, UploadCloud, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { postJson } from "../api";
import type { ProjectBundle, ProjectSummary } from "../types";

interface PortfolioProps {
  projects: ProjectSummary[];
  onOpenProject: (id: string) => void;
  onChanged: () => void;
}

export function Portfolio({ projects, onOpenProject, onChanged }: PortfolioProps) {
  const [creating, setCreating] = useState(false);
  const [importedProject, setImportedProject] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await postJson<ProjectBundle>("/api/executar/projects", importedProject
        ? { project: importedProject }
        : {
            name: String(data.get("name") ?? ""),
            description: String(data.get("description") ?? ""),
            owner: String(data.get("owner") ?? ""),
          });
      setCreating(false);
      setImportedProject(null);
      onChanged();
      onOpenProject(result.project.meta.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o projeto.");
    } finally {
      setPending(false);
    }
  }

  function importFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setImportedProject(parsed.project?.meta ? parsed.project : parsed);
        setError(null);
      } catch {
        setError("O arquivo não contém um JSON válido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="portfolio-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">Portfólio</p>
          <h1>Projetos que avançam.</h1>
          <p>Uma visão executiva de toda a operação.</p>
        </div>
        <button className="button button-orange" type="button" onClick={() => setCreating(true)}>
          <Plus size={17} /> Novo projeto
        </button>
      </header>

      <div className="portfolio-grid">
        {projects.map((project, index) => (
          <article className="project-card" key={project.id}>
            <div className="project-card-top">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{project.id}</small>
            </div>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
            <div className="project-card-progress">
              <div><i style={{ width: `${project.progressPct}%` }} /></div>
              <strong>{project.progressPct}%</strong>
            </div>
            <div className="project-card-meta">
              <span>{project.actionsDone}/{project.actionsTotal} ações</span>
              <button type="button" onClick={() => onOpenProject(project.id)}>
                Abrir <ArrowRight size={16} />
              </button>
            </div>
          </article>
        ))}
        {!projects.length && (
          <button className="project-card project-card-new" type="button" onClick={() => setCreating(true)}>
            <Plus size={26} />
            <strong>Criar primeiro projeto</strong>
            <span>3 fases · 9 áreas · 36 itens</span>
          </button>
        )}
      </div>

      {creating && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <form className="modal exec-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">Novo projeto</p><h2>Transforme contexto em execução.</h2></div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Fechar"><X size={20} /></button>
            </div>

            {importedProject ? (
              <div className="import-ready">
                <FileJson size={21} />
                <div><strong>Projeto JSON carregado</strong><span>O contrato será validado antes de salvar.</span></div>
                <button type="button" onClick={() => setImportedProject(null)}>Remover</button>
              </div>
            ) : (
              <>
                <label>Nome do projeto<input name="name" required autoFocus /></label>
                <label>Contexto e resultado desejado<textarea name="description" rows={5} required placeholder="O que precisa mudar, para quem e como saberemos que terminou?" /></label>
                <label>Responsável<input name="owner" placeholder="Pessoa ou papel responsável" /></label>
                <button className="import-drop" type="button" onClick={() => fileRef.current?.click()}>
                  <UploadCloud size={20} />
                  <span><strong>Ou importe project.json</strong><small>Formato canônico EXECUTA</small></span>
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} />
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="button button-orange" type="submit" disabled={pending}>
                {pending ? "Estruturando…" : "Criar estrutura"} <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
