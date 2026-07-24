import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlogApp } from "./BlogApp";
import { BlogPreviewApp } from "./BlogPreviewApp";

function visit(pathname: string) {
  window.history.replaceState({}, "", pathname);
}

describe("BlogApp", () => {
  beforeEach(() => {
    visit("/blog");
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apresenta o índice editorial e filtra pela busca", async () => {
    const user = userEvent.setup();
    render(<BlogApp />);

    expect(screen.getByRole("heading", {
      name: "Ideias para transformar contexto em execução.",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Da ideia à próxima ação: como o EXECUTA.AI estrutura projetos",
    })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Artigos em carrossel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar movimento dos artigos" })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Buscar no journal" }), "rollback");
    expect(screen.getByRole("heading", {
      name: "Como preparar um lançamento com rollback real",
    })).toBeInTheDocument();
    expect(screen.queryByRole("heading", {
      name: "Por que 3 fases, 9 áreas e 36 itens",
    })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Artigos em carrossel" })).not.toBeInTheDocument();
  });

  it("persiste a visualização em lista", async () => {
    const user = userEvent.setup();
    render(<BlogApp />);
    await user.click(screen.getByRole("button", { name: "Visualizar em lista" }));
    expect(localStorage.getItem("executa-blog-view")).toBe("list");
    expect(screen.getByRole("button", { name: "Visualizar em lista" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renderiza um artigo completo pela rota amigável", () => {
    visit("/blog/cloud-mcp-pwa-mesma-fonte");
    render(<BlogApp />);
    expect(screen.getByRole("heading", {
      name: "Cloud, MCP e PWA sobre a mesma fonte de dados",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Uma operação, dois modos de acesso",
    })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transformar em projeto" })).toHaveAttribute(
      "href",
      "/entrar?origem=blog&artigo=cloud-mcp-pwa-mesma-fonte",
    );
  });

  it("mostra uma página 404 editorial para slug inexistente", () => {
    visit("/blog/nao-existe");
    render(<BlogApp />);
    expect(screen.getByRole("heading", { name: "Este artigo ainda não existe." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao blog/i })).toHaveAttribute("href", "/blog");
  });

  it("confirma a newsletter somente depois da resposta da API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { accepted: true, audit_id: "11111111-1111-1111-1111-111111111111" },
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BlogApp />);

    await user.type(screen.getByRole("textbox", { name: "Seu melhor e-mail" }), "pessoa@example.com");
    await user.click(screen.getByRole("checkbox", { name: /Concordo em receber/i }));
    await user.click(screen.getByRole("button", { name: "Assinar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Inscrição confirmada");
    expect(fetchMock).toHaveBeenCalledWith("/api/blog/newsletter", expect.objectContaining({
      method: "POST",
    }));
  });

  it("navega entre índice e artigo dentro do HTML autônomo", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    render(<BlogPreviewApp />);

    await user.click(screen.getByRole("link", { name: "Ler destaque" }));
    expect(screen.getByRole("heading", {
      name: "Da ideia à próxima ação: como o EXECUTA.AI estrutura projetos",
    })).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("navigation", { name: "Breadcrumb" }))
        .getByRole("link", { name: "Blog" }),
    );
    expect(screen.getByRole("heading", {
      name: "Ideias para transformar contexto em execução.",
    })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});
