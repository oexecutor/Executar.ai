import { ArrowRight, FileText, Sparkles, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

const BRIEF_KEY = "executa.entry.brief";
const IMPORT_KEY = "executa.entry.import";
const FILE_NAME_KEY = "executa.entry.fileName";
const SOURCE_KEY = "executa.entry.source";

function Brand() {
  return <span className="brand-mark"><i aria-hidden="true" />EXECUTA.AI</span>;
}

function openWorkspace(mode: "ai" | "import") {
  window.location.assign(`/app?start=${mode}`);
}

export function Landing() {
  const [brief, setBrief] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = brief.trim();
    if (!value) {
      setError("Descreva o que você quer transformar em plano.");
      return;
    }
    sessionStorage.removeItem(IMPORT_KEY);
    sessionStorage.removeItem(FILE_NAME_KEY);
    sessionStorage.setItem(BRIEF_KEY, value);
    sessionStorage.setItem(SOURCE_KEY, "prompt");
    openWorkspace("ai");
  }

  async function importPlan(file?: File) {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 5 MB.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["json", "md", "txt"].includes(extension)) {
      setError("Use um arquivo JSON, Markdown ou TXT.");
      return;
    }

    const content = await file.text();
    sessionStorage.setItem(FILE_NAME_KEY, file.name);
    sessionStorage.setItem(SOURCE_KEY, "file");

    if (extension === "json") {
      try {
        const parsed = JSON.parse(content) as { project?: unknown } | unknown;
        const project = typeof parsed === "object" && parsed !== null && "project" in parsed
          ? (parsed as { project: unknown }).project
          : parsed;
        sessionStorage.setItem(IMPORT_KEY, JSON.stringify(project));
        sessionStorage.removeItem(BRIEF_KEY);
        openWorkspace("import");
        return;
      } catch {
        setError("O JSON não pôde ser lido. Revise o arquivo e tente novamente.");
        return;
      }
    }

    if (!content.trim()) {
      setError("O arquivo está vazio.");
      return;
    }
    sessionStorage.setItem(BRIEF_KEY, content.trim());
    sessionStorage.removeItem(IMPORT_KEY);
    openWorkspace("ai");
  }

  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void importPlan(event.dataTransfer.files?.[0]);
  }

  const examples = [
    "Lançar meu serviço em 30 dias",
    "Organizar um projeto que já está atrasado",
    "Transformar uma ideia em plano de execução",
  ];

  return (
    <main className="entry-page">
      <nav className="entry-nav" aria-label="Principal">
        <a href="/" aria-label="EXECUTA.AI — início"><Brand /></a>
        <div className="entry-nav-right">
          <span className="entry-free">Grátis no lançamento</span>
          <a href="/app">Entrar</a>
          <a href="/blog">Blog</a>
        </div>
      </nav>

      <section className="entry-hero">
        <div className="entry-heading">
          <p className="eyebrow">COMECE SEM LOGIN</p>
          <h1>Contexto complexo. O que você quer colocar em execução?</h1>
          <p>
            Descreva o objetivo ou traga um plano existente. O EXECUTA organiza o contexto
            e abre um workspace pronto para agir.
          </p>
        </div>

        <form className="entry-composer" onSubmit={submit}>
          <label htmlFor="project-brief">Descreva seu projeto</label>
          <textarea
            id="project-brief"
            value={brief}
            onChange={(event) => {
              setBrief(event.target.value);
              setError(null);
            }}
            placeholder="Ex.: preciso lançar uma consultoria, definir oferta, validar clientes e publicar a primeira versão..."
            rows={5}
            autoFocus
          />
          <div className="entry-composer-foot">
            <span><Sparkles size={16} /> Estrutura inicial 3 · 9 · 36</span>
            <button className="entry-primary" type="submit">
              Gerar plano com IA <ArrowRight size={18} />
            </button>
          </div>
        </form>

        <div className="entry-separator"><span>ou</span></div>

        <button
          className={`entry-dropzone${dragging ? " is-dragging" : ""}`}
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <span className="entry-drop-icon"><UploadCloud size={23} /></span>
          <span>
            <strong>Arraste seu plano para cá</strong>
            <small>ou toque para selecionar · JSON, Markdown ou TXT · até 5 MB</small>
          </span>
          <FileText size={19} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/markdown,.md,text/plain,.txt"
          hidden
          onChange={(event) => void importPlan(event.target.files?.[0])}
        />

        {error && <p className="entry-error" role="alert">{error}</p>}

        <div className="entry-examples" aria-label="Exemplos de início rápido">
          {examples.map((example) => (
            <button type="button" key={example} onClick={() => setBrief(example)}>{example}</button>
          ))}
        </div>

        <p className="entry-trust">
          Sem senha e sem cartão. Uma identidade anônima protege o workspace de cada visitante.
        </p>
      </section>

      <footer className="entry-footer">
        <span>EXECUTA.AI · contexto em ação</span>
        <div><a href="/terms.html">Termos</a><a href="/privacy.html">Privacidade</a></div>
      </footer>
    </main>
  );
}
