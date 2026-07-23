import { Download, ExternalLink, FileText, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiAuthHeaders } from "../auth";
import type { ProjectSummary, VaultEntry } from "../types";

export function Documents({ project }: { project: ProjectSummary | null }) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/vault/files", { headers: await apiAuthHeaders() });
      if (!response.ok) throw new Error("Não foi possível carregar o vault.");
      const body = await response.json() as { entries?: VaultEntry[] };
      setEntries((body.entries ?? []).filter((entry) => !entry.path.startsWith("_desk-os/")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os documentos.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const content = String(data.get("content") ?? "");
    const folder = project ? `Projetos/${project.id}` : "Workspace";
    try {
      const response = await fetch("/api/vault/files", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await apiAuthHeaders() },
        body: JSON.stringify({ path: `${folder}/${title}.md`, content }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Não foi possível criar a nota.");
      }
      setCreating(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a nota.");
    }
  }

  return (
    <section className="documents-page">
      <header className="page-title-row">
        <div><p className="eyebrow">Vault do workspace</p><h1>Documentos e evidências.</h1><p>Arquivos relacionados à mesma operação do Cloud e do aplicativo.</p></div>
        <button className="button button-orange" type="button" onClick={() => setCreating(true)}><Plus size={17} /> Nova nota</button>
      </header>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="document-list">
        <header><span>ARQUIVO</span><span>ATUALIZADO</span><span>TAMANHO</span><span>AÇÕES</span></header>
        {entries.map((entry) => (
          <article key={entry.path}>
            <div><i><FileText size={17} /></i><span><strong>{entry.name}</strong><small>{entry.path}</small></span></div>
            <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(entry.modifiedAt))}</time>
            <span>{entry.sizeBytes < 1024 ? `${entry.sizeBytes} B` : `${Math.round(entry.sizeBytes / 1024)} KB`}</span>
            <div>
              <a href={entry.viewUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${entry.name}`}><ExternalLink size={16} /></a>
              <a href={entry.downloadUrl} aria-label={`Baixar ${entry.name}`}><Download size={16} /></a>
            </div>
          </article>
        ))}
        {!entries.length && <p className="documents-empty">Nenhum documento no workspace.</p>}
      </div>

      {creating && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <form className="modal exec-modal" onSubmit={createNote} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">Vault</p><h2>Nova nota de projeto.</h2></div><button type="button" onClick={() => setCreating(false)} aria-label="Fechar"><X size={20} /></button></div>
            <label>Título<input name="title" required autoFocus /></label>
            <label>Conteúdo<textarea name="content" rows={9} placeholder="# Evidência&#10;&#10;Registre contexto, decisão e fonte." required /></label>
            <div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="button button-orange" type="submit">Criar nota</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
