import { expect, test, type Page } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
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

async function assertNoSeriousAccessibilityViolations(page: Page) {
  await injectAxe(page);
  await checkA11y(page, undefined, {
    axeOptions: {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      rules: { region: { enabled: false } },
    },
    includedImpacts: ["critical", "serious"],
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
}

test.describe("EXECUTA.AI — jornada pública e workspace", () => {
  test("landing comunica o método, abre o login e atende os checks críticos de acessibilidade", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Contexto complexo/ })).toBeVisible();
    await expect(page.getByText("3 fases, 9 áreas e 36 itens")).toBeVisible();
    await assertNoSeriousAccessibilityViolations(page);

    await page.getByRole("link", { name: /^Entrar/ }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole("heading", { name: "Entre para continuar." })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await assertNoSeriousAccessibilityViolations(page);
  });

  test("cadastro e login continuam navegáveis por teclado", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("button", { name: /Ainda não tem uma conta/ }).click();
    await expect(page.getByRole("heading", { name: "Comece a executar." })).toBeVisible();
    await expect(page.getByLabel("Seu nome")).toBeVisible();

    await page.getByLabel("Seu nome").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Senha")).toBeFocused();
  });

  test("sessão isolada abre o portfólio, o projeto canônico e atualiza uma ação", async ({ context, page }) => {
    await context.addCookies([{ name: "e2e_session", value: "1", url: BASE }]);
    await page.goto("/app/");

    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    await expect(page.getByText("EXECUTA Preview")).toBeVisible();
    await page.getByRole("button", { name: "Portfólio" }).click();
    await expect(page.getByRole("heading", { name: "Projetos que avançam." })).toBeVisible();
    await page.getByRole("button", { name: /Abrir/ }).click();

    await expect(page.getByRole("heading", { name: "Lançamento EXECUTA.AI" })).toBeVisible();
    const action = page.getByRole("button", { name: /Validar métricas/ });
    await expect(action).toBeVisible();
    await action.click();
    await expect(page.getByText("2/3 ações concluídas")).toBeVisible();
    await assertNoSeriousAccessibilityViolations(page);
  });

  test("landing e workspace não criam rolagem horizontal em viewport móvel", async ({ context, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await context.addCookies([{ name: "e2e_session", value: "1", url: BASE }]);
    await page.goto("/app/");
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
