import { ArrowRight, FileJson, Plus, Sparkles, UploadCloud, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { postJson } from "../api";
import type { ProjectBundle, ProjectSummary } from "../types";

const BRIEF_KEY = "executa.entry.brief";
const IMPORT_KEY = "executa.entry.import";
const FILE_NAME_KEY = "executa.entry.fileName";
const SOURCE_KEY = "executa.entry.source";

interface PortfolioProps {
  projects: ProjectSummary[];
  onOpenProject: (id: string) => void;
  onChanged: () => void;
}

function readImportedProject(): unknown {
  try {
    const raw = sessionStorage.getItem(IMPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function suggestedName(brief: string, fileName: string): string {
  if (fileName) return fileName.replace(/\.(json|md|txt)$/i, "").replace(/[-_]+/g, " ").trim();
  const firstLine = brief.split("\n").find((line) => line.trim())?.trim() ?? "";
  return firstLine.slice(0, 72);
}

function clearEntryHandoff() {
  sessionStorage.removeItem(BRIEF_KEY);
  sessionStorage.removeItem(IMPORT_KEY);
  sessionStorage.removeItem(FILE_NAME_KEY);
  sessionStorage.removeItem(SOURCE_KEY);
  window.history.replaceState({}, "", "/app");
}

export function Portfolio({ projects, onOpenProject, onChanged }: PortfolioProps) {
  const startMode = new URLSearchParams(window.location.search).get("start");
  const initialBrief = sessionStorage.getItem(BRIEF_KEY) ?? "";
  const initialFileName = sessionStorage.getItem(FILE_NAME_KEY) ?? "";
  const [creating, setCreating] = useState(startMode === "ai" || startMode === "import");
  const [brief] = useState(initialBrief);
  const [fileName] = useState(initialFileName);
  const [importedProject, setImportedProject] = useState<unknown>(readImportedProject);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const usingAi = startMode === "ai" && !importedProject;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const description = String(data.get("description") ?? "");
    const owner = String(data.get("owner") ?? "");
    try {
      const result = await postJson<ProjectBundle>(
        usingAi ? "/api/executar/generate" : "/api/executar/projects",
        importedProject
          ? { project: importedProject }
          : usingAi
            ? { brief: description, name, owner }
            : { name, description, owner },
      );
      setCreating(false);
      setImportedProject(null);
      clearEntryHandoff();
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

  function closeModal() {
    setCreating(false);
    clearEntryHandoff();
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
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <form className="modal exec-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">{startMode === "import" ? "Importar plano" : startMode === "ai" ? "Gerar plano com IA" : "Novo projeto"}</p>
                <h2>Transforme contexto em execução.</h2>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fechar"><X size={20} /></button>
            </div>

            {importedProject ? (
              <div className="import-ready">
                <FileJson size={21} />
                <div>
                  <strong>{fileName || "Projeto JSON carregado"}</strong>
                  <span>O contrato será validado antes de salvar.</span>
                </div>
                <button type="button" onClick={() => setImportedProject(null)}>Remover</button>
              </div>
            ) : (
              <>
                {brief && (
                  <div className="import-ready">
                    <Sparkles size={21} />
                    <div>
                      <strong>{fileName ? `${fileName} recebido` : "Briefing recebido"}</strong>
                      <span>{usingAi ? "A IA vai transformar este contexto em um plano específico 3–9–36." : "Revise os dados antes de gerar a estrutura inicial."}</span>
                    </div>
                  </div>
                )}
                <label>
                  Nome do projeto
                  <input name="name" required autoFocus defaultValue={suggestedName(brief, fileName)} />
                </label>
                <label>
                  Contexto e resultado desejado
                  <textarea
                    name="description"
                    rows={5}
                    required
                    minLength={usingAi ? 20 : undefined}
                    defaultValue={brief}
                    placeholder="O que precisa mudar, para quem e como saberemos que terminou?"
                  />
                </label>
                <label>Responsável<input name="owner" placeholder="Pessoa ou papel responsável" /></label>
                {!usingAi && (
                  <>
                    <button className="import-drop" type="button" onClick={() => fileRef.current?.click()}>
                      <UploadCloud size={20} />
                      <span><strong>Ou importe project.json</strong><small>Formato canônico EXECUTA</small></span>
                    </button>
                    <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} />
                  </>
                )}
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={closeModal}>Cancelar</button>
              <button className="button button-orange" type="submit" disabled={pending}>
                {pending
                  ? usingAi ? "Gerando com IA…" : "Estruturando…"
                  : importedProject ? "Importar projeto" : usingAi ? "Gerar plano com IA" : "Gerar estrutura"} <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
