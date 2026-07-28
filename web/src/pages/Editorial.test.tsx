import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson, postJson, putJson } from "../api";
import type {
  EditorialAdapterEvidence,
  EditorialAdapterName,
  EditorialPublication,
} from "../editorial/types";
import { Editorial } from "./Editorial";

vi.mock("../api", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

function adapterEvidence(
  adapter: EditorialAdapterName,
  status: EditorialAdapterEvidence["status"] = "NOT_RUN",
): EditorialAdapterEvidence {
  const applied = status === "APPLIED";
  return {
    adapter,
    status,
    adapter_version: applied ? "1.0.0" : null,
    publication_version: 1,
    content_hash: applied ? "a".repeat(64) : null,
    started_at: applied ? "2026-07-27T12:01:00.000Z" : null,
    completed_at: applied ? "2026-07-27T12:01:01.000Z" : null,
    findings: { errors: [], warnings: [], recommendations: [] },
    output_reference: applied ? `editorial://test/${adapter}` : null,
    actor: applied ? "Leonardo Batista" : null,
    skip_reason: null,
  };
}

function publication(status: EditorialPublication["status"] = "DRAFT"): EditorialPublication {
  return {
    id: "PUB-20260727-demo",
    version: 1,
    status,
    briefing: {
      title: "Agentes com governança",
      summary: "Como publicar com Preview e aprovação.",
      audience: "Líderes de produto",
      objective: "Demonstrar o fluxo editorial.",
      author: "Leonardo Batista",
      source_text: "# Agentes com governança\n\nConteúdo de origem suficientemente longo para validar o contrato editorial sem publicar automaticamente.\n\n## Preview antes do merge\n\nA aprovação humana permanece explícita.",
      keywords: ["agentes", "governança"],
      channel: "EXECUTA_JOURNAL",
      language: "pt-BR",
    },
    content: {
      slug: "agentes-com-governanca",
      excerpt: "Como publicar com Preview e aprovação.",
      markdown: "# Agentes com governança\n\nConteúdo de origem suficientemente longo para validar o contrato editorial sem publicar automaticamente.\n\n## Preview antes do merge\n\nA aprovação humana permanece explícita.",
      reading_time_minutes: 1,
      generated_at: null,
      updated_at: "2026-07-27T12:00:00.000Z",
    },
    quality: {
      valid: false,
      gate_result: "NOT_RUN",
      score: null,
      errors: [],
      warnings: [],
      checked_at: null,
      content_hash: null,
      adapters: {
        deskgo: adapterEvidence("deskgo"),
        frankwatching: adapterEvidence("frankwatching"),
        ames: adapterEvidence("ames"),
      },
    },
    github: {
      branch: null,
      pull_request_number: null,
      pull_request_url: null,
      commit_sha: null,
      publication_version: null,
      content_hash: null,
    },
    preview: { deployment_id: null, url: null, created_at: null },
    approval: { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null },
    publication: { url: null, published_at: null, commit_sha: null },
    events: [{ id: "evt-1", type: "CREATED", at: "2026-07-27T12:00:00.000Z", actor: "Leonardo Batista", detail: "Briefing editorial criado." }],
    created_at: "2026-07-27T12:00:00.000Z",
    updated_at: "2026-07-27T12:00:00.000Z",
  };
}

describe("Editorial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria um briefing como rascunho sem publicar", async () => {
    const user = userEvent.setup();
    const created = publication();
    vi.mocked(getJson)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(created);
    vi.mocked(postJson).mockResolvedValue(created);

    render(<Editorial />);
    await user.click(await screen.findByRole("button", { name: /nova publicação/i }));
    await user.type(screen.getByLabelText("Título"), "Agentes com governança");
    await user.type(screen.getByLabelText("Resumo executivo"), "Como publicar com Preview e aprovação.");
    await user.type(screen.getByLabelText("Audiência"), "Líderes de produto");
    await user.type(screen.getByLabelText("Objetivo"), "Demonstrar o fluxo editorial.");
    await user.type(screen.getByLabelText("Conteúdo-fonte / artigo inicial"), "# Artigo\n\nConteúdo inicial para revisão.");
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(postJson).toHaveBeenCalledWith("/api/editorial/publications", expect.objectContaining({
      title: "Agentes com governança",
      author: "Leonardo Batista",
    })));
    expect(await screen.findByRole("heading", { name: "Agentes com governança" })).toBeInTheDocument();
    expect(screen.getAllByText("Rascunho")).toHaveLength(2);
  });

  it("executa E2 antes de liberar o gate e o artefato GitHub", async () => {
    const user = userEvent.setup();
    const draft = publication();
    const enriched = {
      ...draft,
      status: "ADAPTERS_APPLIED" as const,
      quality: {
        ...draft.quality,
        adapters: {
          deskgo: adapterEvidence("deskgo", "APPLIED"),
          frankwatching: adapterEvidence("frankwatching", "APPLIED"),
          ames: adapterEvidence("ames", "APPLIED"),
        },
      },
    };
    const validated = {
      ...enriched,
      status: "READY_FOR_PREVIEW" as const,
      quality: {
        ...enriched.quality,
        valid: true,
        gate_result: "PASSED" as const,
        score: 90,
        checked_at: "2026-07-27T12:02:00.000Z",
        content_hash: "a".repeat(64),
      },
    };
    vi.mocked(getJson)
      .mockResolvedValueOnce([{
        id: draft.id,
        title: draft.briefing.title,
        slug: draft.content.slug,
        status: draft.status,
        version: 1,
        preview_url: null,
        publication_url: null,
        updated_at: draft.updated_at,
      }])
      .mockResolvedValueOnce(draft);
    vi.mocked(postJson)
      .mockResolvedValueOnce(enriched)
      .mockResolvedValueOnce(validated);

    render(<Editorial />);
    expect(await screen.findAllByRole("button", { name: "Executar" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /executar gate editorial final/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /aplicar todos os critérios editoriais/i }));
    await waitFor(() => expect(postJson).toHaveBeenCalledWith(
      `/api/editorial/publications/${draft.id}/adapters/run`,
      {},
    ));

    await user.click(await screen.findByRole("button", { name: /executar gate editorial final/i }));
    await waitFor(() => expect(postJson).toHaveBeenCalledWith(
      `/api/editorial/publications/${draft.id}/validate`,
      {},
    ));
    expect(await screen.findByRole("heading", { name: "Registrar artefato GitHub" })).toBeInTheDocument();
    expect(putJson).not.toHaveBeenCalled();
  });
});
