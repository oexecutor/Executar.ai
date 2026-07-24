import { expect, test, type Page } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import { resetState, startMockServer } from "./mock-server";

const PORT = 4173;
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

function trackFailures(page: Page): { errors: string[] } {
  const state = { errors: [] as string[] };
  page.on("pageerror", (error) => state.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") state.errors.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => state.errors.push(`requestfailed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url() !== `http://localhost:${PORT}/api/auth/config`) {
      state.errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  return state;
}

test.describe("EXECUTA.AI — acesso sem login", () => {
  test("raiz entra direto no workspace, sem tela de login", async ({ page }) => {
    const failures = trackFailures(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveCount(0);
    await expect(page.getByLabel("Senha")).toHaveCount(0);
    expect(failures.errors).toEqual([]);
    await assertNoSeriousAccessibilityViolations(page);
  });

  test("/app abre diretamente, sem redirecionamento para /entrar", async ({ page }) => {
    await page.goto("/app/");
    await expect(page).not.toHaveURL(/\/entrar/);
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
  });

  test("navega pelo portfólio, abre o projeto e conclui uma ação", async ({ page }) => {
    await page.goto("/app/");
    await page.getByRole("button", { name: "Portfólio" }).click();
    await expect(page.getByRole("heading", { name: "Projetos que avançam." })).toBeVisible();
    await page.getByRole("button", { name: /Abrir/ }).click();

    await expect(page.getByRole("heading", { name: "Lançamento EXECUTA.AI" })).toBeVisible();
    const action = page.getByRole("button", { name: /Validar métricas/ });
    await expect(action).toBeVisible();
    await action.click();
    await expect(page.getByText("2/3 ações concluídas")).toBeVisible();

    await page.getByRole("button", { name: "Documentos" }).click();
    await expect(page.getByRole("heading", { name: "Documentos e evidências." })).toBeVisible();
    await expect(page.getByText("aceite.md", { exact: true })).toBeVisible();
    await assertNoSeriousAccessibilityViolations(page);
  });

  test("recarregar a página mantém o acesso ao workspace", async ({ page }) => {
    await page.goto("/app/");
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    await expect(page.getByLabel("Senha")).toHaveCount(0);
  });
});

test.describe("EXECUTA Journal — blog", () => {
  test("índice abre, mostra o carrossel e permite abrir um artigo", async ({ page }) => {
    const failures = trackFailures(page);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: /Ideias para transformar contexto em execução/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Artigos em carrossel" })).toBeVisible();
    expect(failures.errors).toEqual([]);
    await assertNoSeriousAccessibilityViolations(page);

    await page.getByRole("region", { name: "Artigos em carrossel" })
      .getByRole("link", { name: /Por que 3 fases, 9 áreas e 36 itens/ })
      .click();
    await expect(page).toHaveURL(/\/blog\/por-que-3-fases-9-areas-36-itens$/);
    await expect(page.getByRole("heading", { level: 1, name: /Por que 3 fases, 9 áreas e 36 itens/ })).toBeVisible();
  });

  test("busca filtra os resultados do índice", async ({ page }) => {
    await page.goto("/blog");
    await page.getByLabel("Buscar no journal").fill("checkpoints");
    await expect(page.getByRole("heading", { name: /Checkpoints: progresso não é apenas tarefa concluída/ })).toBeVisible();
    await expect(page.getByText(/Da ideia à próxima ação/)).toHaveCount(0);
  });

  test("carrossel navega por botão e por teclado", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto("/blog");
    const status = page.locator(".blog-carousel-status span");
    await expect(status).toHaveText("01 / 07");
    await page.getByRole("button", { name: "Próximo artigo" }).click();
    await expect(status).toHaveText("02 / 07");

    const region = page.getByRole("region", { name: "Artigos em carrossel" });
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText("03 / 07");
    await page.keyboard.press("ArrowLeft");
    await expect(status).toHaveText("02 / 07");
  });

  test("artigo abre por slug diretamente, refresh não gera 404, e volta ao índice", async ({ page }) => {
    const failures = trackFailures(page);
    await page.goto("/blog/checkpoints-progresso-verificavel");
    await expect(page.getByRole("heading", { level: 1, name: /Checkpoints: progresso não é apenas tarefa concluída/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /Checkpoints: progresso não é apenas tarefa concluída/ })).toBeVisible();
    expect(failures.errors.some((entry) => entry.includes("404"))).toBe(false);

    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Blog" }).click();
    await expect(page).toHaveURL(/\/blog\/?$/);
    await expect(page.getByRole("heading", { name: /Ideias para transformar contexto em execução/ })).toBeVisible();
  });

  test("slug inexistente mostra estado de não encontrado, não uma tela em branco", async ({ page }) => {
    await page.goto("/blog/este-slug-nao-existe");
    await expect(page.getByRole("heading", { name: "Este artigo ainda não existe." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Voltar ao blog/ })).toBeVisible();
  });
});

test.describe("responsividade", () => {
  test("landing, workspace e blog não criam rolagem horizontal em viewport móvel", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto("/blog");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("workspace e blog não criam rolagem horizontal em viewport tablet", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });

    await page.goto("/app/");
    await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto("/blog");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
