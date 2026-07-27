import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson, postJson, putJson } from "../api";
import type { EditorialPublication } from "../editorial/types";
import { Editorial } from "./Editorial";

vi.mock("../api", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

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
    },
    quality: {
      valid: false,
      score: null,
      errors: [],
      warnings: [],
      checked_at: null,
      adapters: { deskgo: "PENDING", frankwatching: "PENDING", ames: "PENDING" },
    },
    github: { branch: null, pull_request_number: null, pull_request_url: null, commit_sha: null },
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

  it("expõe a validação como próxima ação sem publicar", async () => {
    const user = userEvent.setup();
    const draft = publication();
    const validated = {
      ...draft,
      status: "READY_FOR_PREVIEW" as const,
      quality: { ...draft.quality, valid: true, score: 90 },
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
    vi.mocked(postJson).mockResolvedValue(validated);

    render(<Editorial />);
    await user.click(await screen.findByRole("button", { name: "Executar validação" }));

    await waitFor(() => expect(postJson).toHaveBeenCalledWith(`/api/editorial/publications/${draft.id}/validate`, {}));
    expect(await screen.findByRole("heading", { name: "Registrar o artefato GitHub" })).toBeInTheDocument();
    expect(putJson).not.toHaveBeenCalled();
  });
});
