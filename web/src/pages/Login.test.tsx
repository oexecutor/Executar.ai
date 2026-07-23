import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserSession,
  loadMemberships,
  selectWorkspace,
  signIn,
} from "../auth";
import { Login } from "./Login";

vi.mock("../auth", () => ({
  getBrowserSession: vi.fn(),
  loadMemberships: vi.fn(),
  selectWorkspace: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBrowserSession).mockResolvedValue(null);
  });

  it("possui e-mail, senha e ação acessíveis", () => {
    render(<Login onSuccess={vi.fn()} />);
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /Entrar/ })).toBeInTheDocument();
  });

  it("seleciona automaticamente o único workspace após o login", async () => {
    vi.mocked(signIn).mockResolvedValue({ access_token: "access-token" } as never);
    vi.mocked(loadMemberships).mockResolvedValue([{
      workspaceId: "11111111-1111-1111-1111-111111111111",
      workspaceName: "HQ",
      workspaceSlug: "hq",
      role: "OWNER",
    }]);
    vi.mocked(selectWorkspace).mockResolvedValue();
    const onSuccess = vi.fn();
    render(<Login onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText("E-mail"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "strong-password");
    await userEvent.click(screen.getByRole("button", { name: /Entrar/ }));

    await waitFor(() => expect(selectWorkspace).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({ workspaceName: "HQ" }),
    ));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
