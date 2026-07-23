import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { getJson } from "./api";
import { getBrowserSession, restoreWorkspaceFromAppSession, selectedWorkspace } from "./auth";

vi.mock("./api", () => ({ getJson: vi.fn() }));
vi.mock("./auth", () => ({
  getBrowserSession: vi.fn(),
  restoreWorkspaceFromAppSession: vi.fn(),
  selectedWorkspace: vi.fn(),
  signOut: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(restoreWorkspaceFromAppSession).mockResolvedValue(null);
    localStorage.clear();
  });

  it("mostra autenticação quando não existe sessão Supabase", async () => {
    vi.mocked(getBrowserSession).mockResolvedValue(null);
    vi.mocked(selectedWorkspace).mockReturnValue(null);
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Seu contexto/i })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("abre o workspace quando sessão e workspace são válidos", async () => {
    const workspace = {
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      workspaceSlug: "hq",
      role: "OWNER" as const,
    };
    vi.mocked(restoreWorkspaceFromAppSession).mockResolvedValue(workspace);
    vi.mocked(selectedWorkspace).mockReturnValue(workspace);
    vi.mocked(getJson).mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Execução em foco." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Portfólio" })).toBeInTheDocument();
  });
});
