import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login screen when the session check gets a 401", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401 }),
    );
    render(<App />);
    expect(await screen.findByRole("heading", { name: "DESK-OS" })).toBeInTheDocument();
    expect(screen.getByLabelText("Senha do operador")).toBeInTheDocument();
  });

  it("shows the authenticated shell (Hoje/Sprint nav) when the session check succeeds", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/pm/status") return Promise.resolve(new Response(JSON.stringify({ ok: true, data: {} })));
      if (url === "/api/pm/today")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: { date: "2026-07-21", sprint: null, dominantDelivery: null, nextAction: null, inProgress: [], ready: [], blocked: [], warnings: [] },
            }),
          ),
        );
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: {} })));
    });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sprint" })).toBeInTheDocument();
  });
});
