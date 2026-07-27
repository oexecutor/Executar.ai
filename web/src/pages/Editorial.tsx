import {
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getJson, postJson, putJson } from "../api";
import type {
  EditorialPublication,
  EditorialPublicationSummary,
  EditorialStatus,
} from "../editorial/types";

const STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: "Rascunho",
  VALIDATING: "Validando",
  VALIDATION_FAILED: "Ajustes necessários",
  READY_FOR_PREVIEW: "Pronto para Preview",
  PREVIEW_BUILDING: "Preview em construção",
  PREVIEW_FAILED: "Preview falhou",
  PREVIEW_READY: "Preview pronto",
  IN_REVIEW: "Em revisão",
  CHANGES_REQUESTED: "Alterações solicitadas",
  APPROVED: "Aprovado",
  PUBLISHING: "Publicando",
  PUBLISH_FAILED: "Publicação falhou",
  PUBLISHED: "Publicado",
  QR_FAILED: "QR falhou",
  ARCHIVED: "Arquivado",
};

const ACTION_LABELS: Partial<Record<EditorialStatus, string>> = {
  DRAFT: "Executar validação",
  VALIDATION_FAILED: "Validar novamente",
  CHANGES_REQUESTED: "Validar nova versão",
  PREVIEW_READY: "Iniciar revisão humana",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function summaryFrom(publication: EditorialPublication): EditorialPublicationSummary {
  return {
    id: publication.id,
    title: publication.briefing.title,
    slug: publication.content.slug,
    status: publication.status,
    version: publication.version,
    preview_url: publication.preview.url,
    publication_url: publication.publication.url,
    updated_at: publication.updated_at,
  };
}

export function Editorial() {
  const [publications, setPublications] = useState<EditorialPublicationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publication, setPublication] = useState<EditorialPublication | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const loadList = useCallback(async (preferredId?: string) => {
    const list = await getJson<EditorialPublicationSummary[]>("/api/editorial/publications");
    setPublications(list);
    setSelectedId((current) => preferredId ?? current ?? list[0]?.id ?? null);
  }, []);

  const loadPublication = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setPublication(await getJson<EditorialPublication>(`/api/editorial/publications/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a publicação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar a fila editorial."))
      .finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadPublication(selectedId);
    else setPublication(null);
  }, [loadPublication, selectedId]);

  function replacePublication(next: EditorialPublication) {
    setPublication(next);
    setPublications((current) => {
      const nextSummary = summaryFrom(next);
      const remaining = current.filter((item) => item.id !== next.id);
      return [nextSummary, ...remaining];
    });
  }

  async function runAction(action: () => Promise<EditorialPublication>) {
    setPending(true);
    setError(null);
    try {
      replacePublication(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A ação editorial não foi concluída.");
    } finally {
      setPending(false);
    }
  }

  async function createPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const created = await postJson<EditorialPublication>("/api/editorial/publications", {
        title: String(data.get("title") ?? ""),
        summary: String(data.get("summary") ?? ""),
        audience: String(data.get("audience") ?? ""),
        objective: String(data.get("objective") ?? ""),
        author: String(data.get("author") ?? ""),
        source_text: String(data.get("source_text") ?? ""),
        keywords: String(data.get("keywords") ?? "").split(",").map((keyword) => keyword.trim()).filter(Boolean),
      });
      replacePublication(created);
      setSelectedId(created.id);
      setCreating(false);
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o briefing.");
    } finally {
      setPending(false);
    }
  }

  async function updateContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publication) return;
    const data = new FormData(event.currentTarget);
    await runAction(() => putJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/content`, {
      slug: String(data.get("slug") ?? ""),
      excerpt: String(data.get("excerpt") ?? ""),
      markdown: String(data.get("markdown") ?? ""),
    }));
  }

  async function registerGitHub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publication) return;
    const data = new FormData(event.currentTarget);
    const pullRequestNumber = Number(data.get("pull_request_number"));
    await runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/preview/start`, {
      branch: String(data.get("branch") ?? ""),
      commit_sha: String(data.get("commit_sha") ?? ""),
      pull_request_number: Number.isFinite(pullRequestNumber) && pullRequestNumber > 0 ? pullRequestNumber : undefined,
      pull_request_url: String(data.get("pull_request_url") ?? ""),
    }));
  }

  async function attachPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publication) return;
    const data = new FormData(event.currentTarget);
    await runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/preview/attach`, {
      url: String(data.get("url") ?? ""),
      deployment_id: String(data.get("deployment_id") ?? ""),
    }));
  }

  async function review(decision: "APPROVED" | "CHANGES_REQUESTED") {
    if (!publication) return;
    await runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/review`, {
      decision,
      note: reviewNote,
    }));
  }

  async function completePublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publication) return;
    const data = new FormData(event.currentTarget);
    await runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/publish/complete`, {
      url: String(data.get("url") ?? ""),
      commit_sha: String(data.get("commit_sha") ?? ""),
    }));
  }

  const editable = publication && ["DRAFT", "VALIDATION_FAILED", "CHANGES_REQUESTED"].includes(publication.status);
  const checklist = publication ? [
    { label: "Briefing mínimo completo", done: Boolean(publication.briefing.title && publication.briefing.audience && publication.briefing.objective) },
    { label: "Conteúdo com pelo menos 120 caracteres", done: publication.content.markdown.trim().length >= 120 },
    { label: "Título H1 no artigo", done: /^#\s+.+/m.test(publication.content.markdown) },
    { label: "Seções H2 no artigo", done: /^##\s+.+/m.test(publication.content.markdown) },
    { label: "Preview vinculado ao commit", done: Boolean(publication.preview.url && publication.github.commit_sha) },
    { label: "Aprovação humana registrada", done: publication.approval.decision === "APPROVED" },
  ] : [];

  return (
    <section className="editorial-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">Blog Integration V2</p>
          <h1>Publicação sob controle.</h1>
          <p>Do briefing ao Journal, com Preview e aprovação humana antes de publicar.</p>
        </div>
        <button className="button button-orange" type="button" onClick={() => setCreating(true)}>
          <Plus size={17} /> Nova publicação
        </button>
      </header>

      {error && <p className="inline-error" role="alert">{error}</p>}

      <div className="editorial-workspace">
        <aside className="editorial-queue" aria-label="Fila editorial">
          <div className="editorial-queue-head">
            <div>
              <span>FILA EDITORIAL</span>
              <strong>{publications.length}</strong>
            </div>
            <button type="button" aria-label="Atualizar fila" onClick={() => void loadList()} disabled={loading}>
              <RefreshCw size={16} />
            </button>
          </div>
          {publications.map((item) => (
            <button
              className="editorial-queue-item"
              type="button"
              key={item.id}
              aria-current={selectedId === item.id ? "true" : undefined}
              onClick={() => setSelectedId(item.id)}
            >
              <span>{STATUS_LABELS[item.status]}</span>
              <strong>{item.title}</strong>
              <small>v{item.version} · {formatDate(item.updated_at)}</small>
            </button>
          ))}
          {!loading && !publications.length && (
            <div className="editorial-empty">
              <FileCheck2 size={24} />
              <strong>Nenhuma publicação</strong>
              <span>Crie o primeiro briefing para iniciar.</span>
            </div>
          )}
        </aside>

        <div className="editorial-detail">
          {loading && <div className="project-loading"><div><i /><i /><i /></div><span>Carregando publicação…</span></div>}
          {!loading && !publication && (
            <div className="empty-command">
              <span>PRÓXIMA AÇÃO</span>
              <h2>Crie o primeiro briefing editorial.</h2>
              <p>O rascunho fica salvo no workspace e nenhuma publicação acontece automaticamente.</p>
              <button className="button button-orange" type="button" onClick={() => setCreating(true)}>
                Criar publicação <ArrowRight size={17} />
              </button>
            </div>
          )}

          {!loading && publication && (
            <>
              <header className="editorial-detail-head">
                <div>
                  <div className="editorial-meta">
                    <span className={`editorial-status status-${publication.status.toLowerCase()}`}>{STATUS_LABELS[publication.status]}</span>
                    <code>{publication.id}</code>
                    <span>v{publication.version}</span>
                  </div>
                  <h2>{publication.briefing.title}</h2>
                  <p>{publication.briefing.summary}</p>
                </div>
                {publication.preview.url && (
                  <a className="button button-quiet button-compact" href={publication.preview.url} target="_blank" rel="noreferrer">
                    Abrir Preview <ExternalLink size={15} />
                  </a>
                )}
                {publication.publication.url && (
                  <a className="button button-orange button-compact" href={publication.publication.url} target="_blank" rel="noreferrer">
                    Abrir artigo <ExternalLink size={15} />
                  </a>
                )}
              </header>

              <div className="editorial-grid">
                <article className="editorial-panel">
                  <p className="eyebrow">Checklist do gate</p>
                  <div className="editorial-checklist">
                    {checklist.map((item) => (
                      <div key={item.label} className={item.done ? "is-done" : ""}>
                        <i>{item.done ? <Check size={14} /> : <CircleAlert size={14} />}</i>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  {publication.quality.score !== null && (
                    <div className="editorial-score">
                      <span>QUALIDADE</span>
                      <strong>{publication.quality.score}<small>/100</small></strong>
                    </div>
                  )}
                </article>

                <article className="editorial-panel editorial-next">
                  <p className="eyebrow">Próxima ação</p>
                  {(publication.status === "DRAFT" || publication.status === "VALIDATION_FAILED" || publication.status === "CHANGES_REQUESTED") && (
                    <>
                      <h3>{ACTION_LABELS[publication.status]}</h3>
                      <p>Verifica o contrato e prepara o rascunho para receber um Preview. Nada será publicado.</p>
                      <button
                        className="button button-orange"
                        type="button"
                        disabled={pending}
                        onClick={() => void runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/validate`, {}))}
                      >
                        {pending ? "Validando…" : ACTION_LABELS[publication.status]} <ArrowRight size={16} />
                      </button>
                    </>
                  )}

                  {publication.status === "READY_FOR_PREVIEW" && (
                    <form className="editorial-action-form" onSubmit={registerGitHub}>
                      <h3>Registrar o artefato GitHub</h3>
                      <p>Informe a branch e o commit exatos que serão homologados no Preview.</p>
                      <label>Branch<input name="branch" required placeholder={`editorial/${publication.id.toLowerCase()}-${publication.content.slug}`} /></label>
                      <label>Commit SHA<input name="commit_sha" required minLength={40} maxLength={40} /></label>
                      <div className="editorial-form-row">
                        <label>Nº do PR<input name="pull_request_number" inputMode="numeric" /></label>
                        <label>URL do PR<input name="pull_request_url" type="url" /></label>
                      </div>
                      <button className="button button-orange" type="submit" disabled={pending}>Iniciar Preview</button>
                    </form>
                  )}

                  {(publication.status === "PREVIEW_BUILDING" || publication.status === "PREVIEW_FAILED") && (
                    <form className="editorial-action-form" onSubmit={attachPreview}>
                      <h3>Vincular o Preview Vercel</h3>
                      <p>O endereço fica preso ao commit registrado e será usado na revisão humana.</p>
                      <label>URL imutável do Preview<input name="url" type="url" required /></label>
                      <label>Deployment ID<input name="deployment_id" placeholder="dpl_…" /></label>
                      <button className="button button-orange" type="submit" disabled={pending}>Registrar Preview</button>
                    </form>
                  )}

                  {publication.status === "PREVIEW_READY" && (
                    <>
                      <h3>Preview disponível</h3>
                      <p>Abra o artigo, confira o conteúdo e só então inicie a decisão humana.</p>
                      <button
                        className="button button-orange"
                        type="button"
                        disabled={pending}
                        onClick={() => void runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/review/start`, {}))}
                      >
                        Iniciar revisão humana
                      </button>
                    </>
                  )}

                  {publication.status === "IN_REVIEW" && (
                    <div className="editorial-action-form">
                      <h3>Decisão humana</h3>
                      <p>A aprovação fica vinculada ao commit <code>{publication.github.commit_sha?.slice(0, 8)}</code>.</p>
                      <label>Nota da revisão<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} /></label>
                      <div className="editorial-review-actions">
                        <button className="button button-quiet" type="button" disabled={pending} onClick={() => void review("CHANGES_REQUESTED")}>Solicitar alterações</button>
                        <button className="button button-orange" type="button" disabled={pending} onClick={() => void review("APPROVED")}>Aprovar commit</button>
                      </div>
                    </div>
                  )}

                  {publication.status === "APPROVED" && (
                    <>
                      <h3>Commit aprovado</h3>
                      <p>Esta ação apenas abre a etapa de publicação. O merge continua sendo uma ação externa e controlada.</p>
                      <label className="editorial-confirm">
                        <input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} />
                        <span>Confirmo que revisei o Preview e autorizo iniciar a publicação.</span>
                      </label>
                      <button
                        className="button button-orange"
                        type="button"
                        disabled={pending || !publishConfirmed}
                        onClick={() => void runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/publish/start`, {}))}
                      >
                        Iniciar publicação
                      </button>
                    </>
                  )}

                  {publication.status === "PUBLISHING" && (
                    <form className="editorial-action-form" onSubmit={completePublication}>
                      <h3>Registrar produção</h3>
                      <p>Conclua somente depois que o commit aprovado estiver na main e a URL pública responder.</p>
                      <label>URL pública<input name="url" type="url" required /></label>
                      <label>Commit da main<input name="commit_sha" required minLength={40} maxLength={40} defaultValue={publication.github.commit_sha ?? ""} /></label>
                      <button className="button button-orange" type="submit" disabled={pending}>Confirmar publicação</button>
                    </form>
                  )}

                  {publication.status === "PUBLISHED" && (
                    <>
                      <h3>Publicação concluída</h3>
                      <p>O artigo, o commit e a decisão humana estão registrados na mesma trilha de auditoria.</p>
                      <span className="editorial-complete"><Check size={18} /> Publicado em {publication.publication.published_at ? formatDate(publication.publication.published_at) : "produção"}</span>
                    </>
                  )}
                </article>
              </div>

              {editable && (
                <details className="editorial-editor">
                  <summary>Editar conteúdo do rascunho</summary>
                  <form onSubmit={updateContent}>
                    <div className="editorial-form-row">
                      <label>Slug<input name="slug" defaultValue={publication.content.slug} required /></label>
                      <label>Resumo público<input name="excerpt" defaultValue={publication.content.excerpt} required /></label>
                    </div>
                    <label>Artigo em Markdown<textarea name="markdown" defaultValue={publication.content.markdown} rows={18} required /></label>
                    <button className="button button-dark" type="submit" disabled={pending}>Salvar nova versão</button>
                  </form>
                </details>
              )}

              {(publication.quality.errors.length > 0 || publication.quality.warnings.length > 0) && (
                <section className="editorial-findings">
                  <h3>Resultado do gate editorial</h3>
                  {publication.quality.errors.map((message) => <p className="is-error" key={message}><CircleAlert size={15} /> {message}</p>)}
                  {publication.quality.warnings.map((message) => <p key={message}><CircleAlert size={15} /> {message}</p>)}
                </section>
              )}

              <details className="editorial-timeline">
                <summary>Histórico e evidências ({publication.events.length})</summary>
                <ol>
                  {[...publication.events].reverse().map((item) => (
                    <li key={item.id}>
                      <time>{formatDate(item.at)}</time>
                      <strong>{item.detail}</strong>
                      <span>{item.actor}{item.to_status ? ` · ${STATUS_LABELS[item.to_status]}` : ""}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>
      </div>

      {creating && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <form className="modal exec-modal editorial-intake" onSubmit={createPublication} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">Intake editorial</p><h2>Novo briefing.</h2></div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Fechar"><X size={20} /></button>
            </div>
            <p className="editorial-intake-note">Salva como rascunho. Não cria PR, não faz merge e não publica.</p>
            <label>Título<input name="title" required autoFocus /></label>
            <label>Resumo executivo<textarea name="summary" rows={3} required /></label>
            <div className="editorial-form-row">
              <label>Audiência<input name="audience" required /></label>
              <label>Autor<input name="author" required defaultValue="Leonardo Batista" /></label>
            </div>
            <label>Objetivo<textarea name="objective" rows={3} required placeholder="O que o leitor deve entender, decidir ou fazer?" /></label>
            <label>Conteúdo-fonte / artigo inicial<textarea name="source_text" rows={10} required placeholder="# Título&#10;&#10;Contexto…&#10;&#10;## Primeira seção" /></label>
            <label>Palavras-chave<input name="keywords" placeholder="IA, agentes, MCP, workflows" /></label>
            <div className="modal-actions">
              <button className="button button-quiet" type="button" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="button button-orange" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar rascunho"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
