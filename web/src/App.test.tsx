import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { getJson } from "./api";
import { ensureWorkspaceSession, selectedWorkspace } from "./auth";

vi.mock("./api", () => ({ getJson: vi.fn() }));
vi.mock("./auth", () => ({
  ensureWorkspaceSession: vi.fn(),
  selectedWorkspace: vi.fn(),
}));

const workspace = {
  workspaceId: "11111111-1111-1111-1111-111111111111",
  workspaceName: "Meu workspace EXECUTA",
  workspaceSlug: "meu-workspace",
  role: "OWNER" as const,
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/app");
    vi.mocked(ensureWorkspaceSession).mockResolvedValue(workspace);
    vi.mocked(selectedWorkspace).mockReturnValue(workspace);
    vi.mocked(getJson).mockResolvedValue([]);
  });

  it("abre o workspace gratuito sem renderizar formulário de login", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Execução em foco." })).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
  });

  it("abre o portfólio quando a entrada veio do gerador", async () => {
    window.history.replaceState({}, "", "/app?start=ai");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Projetos que avançam." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transforme contexto em execução." })).toBeInTheDocument();
  });

  it("mostra recuperação quando a sessão gratuita falha", async () => {
    vi.mocked(ensureWorkspaceSession).mockRejectedValueOnce(new Error("Falha temporária."));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Seu workspace não abriu." })).toBeInTheDocument();
    expect(screen.getByText("Falha temporária.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
