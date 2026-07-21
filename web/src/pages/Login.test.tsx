import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login";

describe("Login", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has an accessible password field and submit button", () => {
    render(<Login onSuccess={vi.fn()} />);
    expect(screen.getByLabelText("Senha do operador")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("calls onSuccess after a successful login", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 200 }));
    const onSuccess = vi.fn();
    render(<Login onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText("Senha do operador"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error message and does not call onSuccess on a wrong password", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Senha inválida." } }), { status: 401 }),
    );
    const onSuccess = vi.fn();
    render(<Login onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText("Senha do operador"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha inválida.");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
