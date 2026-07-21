import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskForm } from "./TaskForm";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), { status });
}

describe("TaskForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires title and outcome to create a task", async () => {
    const onSaved = vi.fn();
    render(<TaskForm projectId="prj_1" sprintId="spr_1" onSaved={onSaved} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Título é obrigatório.");
    expect(onSaved).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a create payload with only the filled-in steps", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ id: "tsk_1" }));
    const onSaved = vi.fn();
    render(<TaskForm projectId="prj_1" sprintId="spr_1" onSaved={onSaved} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Título"), "Implementar board");
    await userEvent.type(screen.getByLabelText("Resultado observável"), "Board lê o índice");
    await userEvent.type(screen.getByLabelText("Passo 1"), "Definir colunas");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      projectId: "prj_1",
      sprintId: "spr_1",
      title: "Implementar board",
      outcome: "Board lê o índice",
      steps: [{ title: "Definir colunas" }],
    });
    expect(body.idempotency_key).toBeTruthy();
  });

  it("edit mode hides the outcome field and does not require it", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ id: "tsk_1" }));
    const onSaved = vi.fn();
    render(
      <TaskForm
        projectId="prj_1"
        sprintId="spr_1"
        task={{
          id: "tsk_1",
          projectId: "prj_1",
          sprintId: "spr_1",
          title: "Old title",
          status: "READY",
          priority: "MEDIUM",
          position: 1,
          dominantDate: null,
          dueAt: null,
          blockedReason: null,
          stepsTotal: 0,
          stepsDone: 0,
          version: 3,
        }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Resultado observável")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/pm/tasks/tsk_1");
    expect(JSON.parse(init.body as string)).toMatchObject({ expected_version: 3 });
  });
});
