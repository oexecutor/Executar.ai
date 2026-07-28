import {
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Plus,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getJson, postJson, putJson } from "../api";
import type {
  EditorialAdapterEvidence,
  EditorialAdapterName,
  EditorialPublication,
  EditorialPublicationSummary,
  EditorialQrAction,
  EditorialStatus,
} from "../editorial/types";

const STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: "Rascunho",
  CONTENT_READY: "Conteúdo pronto",
  ENRICHING: "Verificação interna",
  ADAPTERS_APPLIED: "Regras internas aplicadas",
  ADAPTER_FAILED: "Regra interna falhou",
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

const ADAPTER_LABELS: Record<EditorialAdapterName, string> = {
  deskgo: "Formato e densidade",
  frankwatching: "Clareza e estrutura",
  ames: "Conformidade multiformato",
};

const ADAPTER_NAMES = Object.keys(ADAPTER_LABELS) as EditorialAdapterName[];

const QR_LABELS: Record<EditorialQrAction, {
  code: string;
  title: string;
  description: string;
}> = {
  CREATE: {
    code: "QR-01",
    title: "Criar / Processar",
    description: "Abre o intake editorial; nenhuma publicação é criada pelo GET.",
  },
  PREVIEW: {
    code: "QR-02",
    title: "Revisar Preview",
    description: "Resolve o Preview atual do commit editorial.",
  },
  APPROVE: {
    code: "QR-03",
    title: "Aprovar / Publicar",
    description: "Abre o contexto autorizado; nunca aprova nem faz merge sozinho.",
  },
  ANALYTICS: {
    code: "QR-04",
    title: "Medir",
    description: "Abre histórico e analytics disponíveis para a publicação.",
  },
};

const QR_ACTIONS = Object.keys(QR_LABELS) as EditorialQrAction[];

function initialEditorialContext() {
  const query = new URLSearchParams(window.location.search);
  return {
    publicationId: query.get("publication"),
    intent: query.get("intent"),
  };
}

function adapterResultLabel(evidence: EditorialAdapterEvidence): string {
  if (evidence.status === "APPLIED" && evidence.findings.errors.length > 0) {
    return `${evidence.findings.errors.length} bloqueador(es)`;
  }
  if (evidence.status === "APPLIED" && evidence.findings.warnings.length > 0) {
    return `${evidence.findings.warnings.length} alerta(s)`;
  }
  const labels: Record<EditorialAdapterEvidence["status"], string> = {
    NOT_RUN: "Não executado",
    RUNNING: "Executando",
    APPLIED: "Aprovado",
    FAILED: "Falhou",
    STALE: "Desatualizado",
    SKIPPED: "Dispensado",
  };
  return labels[evidence.status];
}

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
  const [initialContext] = useState(initialEditorialContext);
  const [publications, setPublications] = useState<EditorialPublicationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publication, setPublication] = useState<EditorialPublication | null>(null);
  const [creating, setCreating] = useState(initialContext.intent === "create");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const loadList = useCallback(async (preferredId?: string) => {
    const list = await getJson<EditorialPublicationSummary[]>("/api/editorial/publications");
    setPublications(list);
    setSelectedId((current) => {
      if (preferredId && list.some((item) => item.id === preferredId)) {
        return preferredId;
      }
      if (current && list.some((item) => item.id === current)) return current;
      return list[0]?.id ?? null;
    });
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
    loadList(initialContext.publicationId ?? undefined)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar a fila editorial."))
      .finally(() => setLoading(false));
  }, [initialContext.publicationId, loadList]);

  useEffect(() => {
    if (selectedId) void loadPublication(selectedId);
    else setPublication(null);
  }, [loadPublication, selectedId]);

  const replacePublication = useCallback((next: EditorialPublication) => {
    setPublication(next);
    setPublications((current) => {
      const nextSummary = summaryFrom(next);
      const remaining = current.filter((item) => item.id !== next.id);
      return [nextSummary, ...remaining];
    });
  }, []);

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

  async function createArtifact() {
    if (!publication) return;
    await runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/artifact/create`, {
      confirm: true,
    }));
  }

  async function runAdapters(adapter?: EditorialAdapterName) {
    if (!publication) return;
    await runAction(() => postJson<EditorialPublication>(
      `/api/editorial/publications/${publication.id}/quality/rules/run`,
      adapter ? { adapter } : {},
    ));
  }

  async function syncPreview() {
    if (!publication) return;
    await runAction(() => postJson<EditorialPublication>(
      `/api/editorial/publications/${publication.id}/preview/sync`,
      {},
    ));
  }

  const previewBuildingId = publication?.status === "PREVIEW_BUILDING"
    ? publication.id
    : null;

  useEffect(() => {
    if (!previewBuildingId) return;
    let active = true;
    let syncing = false;
    const synchronize = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const next = await postJson<EditorialPublication>(
          `/api/editorial/publications/${previewBuildingId}/preview/sync`,
          {},
        );
        if (active) replacePublication(next);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Não foi possível consultar o Vercel Preview.");
        }
      } finally {
        syncing = false;
      }
    };
    void synchronize();
    const timer = window.setInterval(() => void synchronize(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [previewBuildingId, replacePublication]);

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

  async function issueQrCodes() {
    if (!publication) return;
    await runAction(() => postJson<EditorialPublication>(
      `/api/editorial/publications/${publication.id}/qr`,
      { confirm: true },
    ));
  }

  const editable = publication && [
    "DRAFT",
    "CONTENT_READY",
    "ADAPTERS_APPLIED",
    "ADAPTER_FAILED",
    "VALIDATION_FAILED",
    "CHANGES_REQUESTED",
  ].includes(publication.status);
  const structureChecklist = publication ? [
    { label: "Briefing mínimo completo", done: Boolean(publication.briefing.title && publication.briefing.audience && publication.briefing.objective) },
    { label: "Conteúdo com pelo menos 120 caracteres", done: publication.content.markdown.trim().length >= 120 },
    { label: "Título H1 no artigo", done: /^#\s+.+/m.test(publication.content.markdown) },
    { label: "Seções H2 no artigo", done: /^##\s+.+/m.test(publication.content.markdown) },
  ] : [];
  const structureReady = structureChecklist.every((item) => item.done);
  const e1QualityAvailable = publication && [
    "DRAFT",
    "CONTENT_READY",
    "ENRICHING",
    "ADAPTERS_APPLIED",
    "ADAPTER_FAILED",
    "VALIDATION_FAILED",
    "CHANGES_REQUESTED",
  ].includes(publication.status);

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

      {initialContext.intent === "preview-unavailable" && (
        <p className="editorial-context-notice" role="status">
          O QR-02 encontrou um Preview indisponível e trouxe você ao fallback seguro.
        </p>
      )}
      {initialContext.intent === "approve" && (
        <p className="editorial-context-notice" role="status">
          O QR-03 abriu o contexto de revisão. Escanear não aprova, não faz merge e não publica.
        </p>
      )}
      {initialContext.intent === "analytics" && (
        <p className="editorial-context-notice" role="status">
          O QR-04 abriu a trilha da publicação. Métricas completas pertencem à E6.
        </p>
      )}

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
                  <p className="eyebrow">E1 — Intake e pacote editorial</p>
                  <div className="editorial-checklist">
                    {structureChecklist.map((item) => (
                      <div key={item.label} className={item.done ? "is-done" : ""}>
                        <i>{item.done ? <Check size={14} /> : <CircleAlert size={14} />}</i>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`editorial-gate-result gate-${publication.quality.gate_result.toLowerCase()}`}>
                    <span>GATE INTERNO DA E1</span>
                    <strong>
                      {publication.quality.gate_result === "PASSED"
                        ? "APROVADO"
                        : publication.quality.gate_result === "FAILED"
                          ? "REPROVADO"
                          : "NÃO EXECUTADO"}
                    </strong>
                  </div>
                  {publication.quality.score !== null && (
                    <div className="editorial-score">
                      <span>PONTUAÇÃO EDITORIAL</span>
                      <strong>{publication.quality.score}<small>/100</small></strong>
                    </div>
                  )}
                </article>

                <article className="editorial-panel editorial-next">
                  <p className="eyebrow">Próxima ação</p>
                  {e1QualityAvailable && (
                    <div className="editorial-e2">
                      <div className="editorial-e2-head">
                        <span>E1 · QUALIDADE INTERNA</span>
                        <h3>Regras determinísticas do aplicativo</h3>
                        <p>
                          Estas verificações locais ajudam a fechar o pacote da E1. Elas não executam
                          Desk&amp;Go, Frankwatching nem AMES; as chaves antigas permanecem apenas por compatibilidade de dados.
                        </p>
                      </div>

                      <div className="editorial-adapters">
                        {ADAPTER_NAMES.map((adapter) => {
                          const evidence = publication.quality.adapters[adapter];
                          const hasReport = evidence.status !== "NOT_RUN" && evidence.status !== "RUNNING";
                          return (
                            <div className={`editorial-adapter adapter-${evidence.status.toLowerCase()}`} key={adapter}>
                              <div>
                                <strong>{ADAPTER_LABELS[adapter]}</strong>
                                <span>{adapterResultLabel(evidence)}</span>
                              </div>
                              <button
                                className="button button-quiet button-compact"
                                type="button"
                                disabled={pending || !structureReady || evidence.status === "RUNNING"}
                                onClick={() => void runAdapters(adapter)}
                              >
                                {evidence.status === "RUNNING" ? "Executando…" : "Executar"}
                              </button>
                              {hasReport && (
                                <details>
                                  <summary>Ver relatório</summary>
                                  <div>
                                    <small>
                                      {evidence.adapter_version ? `v${evidence.adapter_version}` : "sem versão"}
                                      {" · "}
                                      publicação v{evidence.publication_version}
                                    </small>
                                    {evidence.findings.errors.map((message) => <p className="is-error" key={message}>{message}</p>)}
                                    {evidence.findings.warnings.map((message) => <p className="is-warning" key={message}>{message}</p>)}
                                    {evidence.findings.recommendations.map((message) => <p key={message}>{message}</p>)}
                                    {!evidence.findings.errors.length
                                      && !evidence.findings.warnings.length
                                      && !evidence.findings.recommendations.length
                                      && <p>Nenhum achado.</p>}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        className="button button-dark editorial-apply-all"
                        type="button"
                        disabled={pending || !structureReady}
                        onClick={() => void runAdapters()}
                      >
                        {pending ? "Executando regras…" : "Executar todas as regras internas"}
                      </button>
                      {!structureReady && <p className="editorial-blocked">Corrija a estrutura mínima antes de executar as regras internas.</p>}

                      <div className="editorial-final-gate">
                        <span>E1 · GATE DO PACOTE</span>
                        <h3>Concluir intake e pacote editorial</h3>
                        {publication.status === "ADAPTERS_APPLIED" ? (
                          <button
                            className="button button-orange"
                            type="button"
                            disabled={pending}
                            onClick={() => void runAction(() => postJson<EditorialPublication>(`/api/editorial/publications/${publication.id}/validate`, {}))}
                          >
                            {pending ? "Validando…" : "Executar gate interno da E1"} <ArrowRight size={16} />
                          </button>
                        ) : (
                          <p>Disponível somente quando as três regras internas tiverem evidência válida para a versão atual.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {publication.status === "READY_FOR_PREVIEW" && (
                    <div className="editorial-action-form">
                      <p className="editorial-gate-approved"><Check size={16} /> E1 concluída — pacote liberado para a E2 oficial.</p>
                      <span className="eyebrow">E2 — GitHub e Vercel Preview</span>
                      <h3>Criar branch, commit, PR e Preview</h3>
                      <p>
                        O servidor grava o artigo, os metadados e a capa, abre um PR draft e captura
                        o deployment Vercel pelo SHA exato. Nenhuma evidência é digitada manualmente.
                      </p>
                      <button
                        className="button button-orange"
                        type="button"
                        disabled={pending}
                        onClick={() => void createArtifact()}
                      >
                        {pending ? "Criando E2…" : "Criar artefato e iniciar Preview"}
                      </button>
                    </div>
                  )}

                  {(publication.status === "PREVIEW_BUILDING" || publication.status === "PREVIEW_FAILED") && (
                    <div className="editorial-action-form">
                      <span className="eyebrow">E2 — GitHub e Vercel Preview</span>
                      <h3>{publication.status === "PREVIEW_FAILED" ? "Preview falhou" : "Aguardando Vercel Preview"}</h3>
                      <p>
                        A consulta automática procura um deployment não produtivo cujo SHA corresponda
                        exatamente ao commit do pacote editorial.
                      </p>
                      {publication.github.pull_request_url && (
                        <a
                          className="button button-quiet button-compact"
                          href={publication.github.pull_request_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PR #{publication.github.pull_request_number} <ExternalLink size={15} />
                        </a>
                      )}
                      <code>{publication.github.commit_sha}</code>
                      <button
                        className="button button-orange"
                        type="button"
                        disabled={pending}
                        onClick={() => void syncPreview()}
                      >
                        {pending ? "Consultando…" : "Atualizar status do Preview"}
                      </button>
                    </div>
                  )}

                  {publication.status === "PREVIEW_READY" && (
                    <>
                      <span className="eyebrow">E2 concluída</span>
                      <h3>Preview disponível para a E3</h3>
                      <p>O PR e o Preview estão vinculados ao mesmo commit. Abra o artigo e só então inicie a revisão humana.</p>
                      {publication.github.pull_request_url && (
                        <a
                          className="button button-quiet button-compact"
                          href={publication.github.pull_request_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PR #{publication.github.pull_request_number} <ExternalLink size={15} />
                        </a>
                      )}
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

                  {(publication.status === "PUBLISHED" || publication.status === "QR_FAILED") && (
                    <div className="editorial-action-form">
                      <span className="eyebrow">E4 — QR Router semântico · P0</span>
                      <h3>
                        {publication.qr.issued_at
                          ? "Quatro rotas semânticas ativas"
                          : publication.status === "QR_FAILED"
                            ? "Emissão de QR falhou"
                            : "Emitir QR-01 a QR-04"}
                      </h3>
                      <p>
                        Cada imagem codifica somente uma rota estável do EXECUTA.AI.
                        Destino, fornecedor e URL de Preview são resolvidos no servidor.
                      </p>
                      {!publication.qr.issued_at && (
                        <button
                          className="button button-orange"
                          type="button"
                          disabled={pending}
                          onClick={() => void issueQrCodes()}
                        >
                          <QrCode size={17} />
                          {pending ? "Emitindo QRs…" : "Emitir quatro QRs semânticos"}
                        </button>
                      )}
                      {publication.qr.issued_at && (
                        <div className="editorial-qr-grid" aria-label="QR Codes semânticos">
                          {QR_ACTIONS.map((action) => {
                            const route = publication.qr.routes[action];
                            if (!route) return null;
                            const label = QR_LABELS[action];
                            return (
                              <article className="editorial-qr-card" key={action}>
                                <header>
                                  <span>{label.code}</span>
                                  <strong>{label.title}</strong>
                                </header>
                                <img
                                  src={`/q/${route.token}.svg`}
                                  alt={`${label.code} — ${label.title}`}
                                  width="180"
                                  height="180"
                                />
                                <p>{label.description}</p>
                                <a href={route.url}>
                                  Continuar tarefa atual neste dispositivo.
                                </a>
                              </article>
                            );
                          })}
                        </div>
                      )}
                      <span className="editorial-complete">
                        <Check size={18} /> Publicado em {publication.publication.published_at ? formatDate(publication.publication.published_at) : "produção"}
                      </span>
                    </div>
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
