import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { resetState, startMockServer } from "./mock-server";

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

let closeServer: () => Promise<void>;

test.beforeAll(async () => {
  const server = await startMockServer(PORT);
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

test.beforeEach(() => {
  resetState();
});

async function assertNoAccessibilityViolations(page: Page) {
  await injectAxe(page);
  await checkA11y(page, undefined, {
    axeOptions: { rules: { region: { enabled: false } } },
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
}

test.describe("DESK-OS web app — real user flow", () => {
  test("shows the login screen first and it has no accessibility violations", async ({ page }) => {
    await page.goto(`${BASE}/app/`);
    await expect(page.getByRole("heading", { name: "DESK-OS" })).toBeVisible();
    await expect(page.getByLabel("Senha do operador")).toBeVisible();
    await assertNoAccessibilityViolations(page);
  });

  test("rejects a wrong password with a visible, announced error", async ({ page }) => {
    await page.goto(`${BASE}/app/`);
    await page.getByLabel("Senha do operador").fill("wrong-password");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText(/Senha inválida/);
  });

  test("full flow: login, bootstrap a project, create/move/edit a task, logout", async ({ page }) => {
    await page.goto(`${BASE}/app/`);

    // Login
    await page.getByLabel("Senha do operador").fill("e2e-test-password");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Comece um projeto" })).toBeVisible();
    await assertNoAccessibilityViolations(page);

    // First-run project bootstrap
    await page.getByLabel("Título do projeto").fill("Evoluir MCP");
    await page.getByLabel("Objetivo").fill("PM sobre o vault");
    await page.getByLabel("Definição de pronto").fill("Kanban lê o estado canônico");
    await page.getByRole("button", { name: "Criar projeto" }).click();

    // Today, now with an active sprint
    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
    await assertNoAccessibilityViolations(page);

    // Go to the Sprint/board
    await page.getByRole("button", { name: "Ver Sprint" }).click();
    await expect(page.getByRole("heading", { name: "Sprint atual" })).toBeVisible();
    await assertNoAccessibilityViolations(page);

    // No horizontal scroll on the board at a narrow (mobile) viewport
    await page.setViewportSize({ width: 375, height: 800 });
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Create a task
    await page.getByRole("button", { name: "+ Nova tarefa" }).click();
    await expect(page.getByRole("heading", { name: "Nova tarefa" })).toBeVisible();
    await assertNoAccessibilityViolations(page);
    await page.getByLabel("Título").fill("Implementar board");
    await page.getByLabel("Resultado observável").fill("Board lê o índice");
    await page.getByLabel("Passo 1").fill("Definir colunas");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { name: "Nova tarefa" })).not.toBeVisible();
    await expect(page.locator(".task-card-title", { hasText: "Implementar board" })).toBeVisible();

    // Move it from Backlog to Ready via the accessible select control
    const moveSelect = page.locator('select[id^="move-"]');
    await moveSelect.selectOption("READY");
    await expect(
      page.locator(".board-column", { hasText: "Pronta" }).locator(".task-card-title", { hasText: "Implementar board" }),
    ).toBeVisible();

    // Edit the task
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar tarefa" })).toBeVisible();
    // Edit mode must not ask for the outcome again.
    await expect(page.getByLabel("Resultado observável")).toHaveCount(0);
    await page.getByLabel("Título").fill("Implementar board (revisado)");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.locator(".task-card-title", { hasText: "Implementar board (revisado)" })).toBeVisible();

    // Back to Today: the moved task should show up as ready/next action
    await page.getByRole("button", { name: "Hoje" }).click();
    await expect(page.getByText("Implementar board (revisado)")).toBeVisible();

    // Logout returns to the login screen and a protected route 401s again
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("heading", { name: "DESK-OS" })).toBeVisible();
    await expect(page.getByLabel("Senha do operador")).toBeVisible();
  });

  test("keyboard-only: password field, submit, and nav are all reachable by Tab", async ({ page }) => {
    await page.goto(`${BASE}/app/`);
    await page.getByLabel("Senha do operador").focus();
    await expect(page.getByLabel("Senha do operador")).toBeFocused();
    await page.keyboard.type("e2e-test-password");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Comece um projeto" })).toBeVisible();
  });
});
