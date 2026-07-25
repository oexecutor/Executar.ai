import { expect, test } from "@playwright/test";

const runProductionSmoke = process.env.RUN_PRODUCTION_SMOKE === "true";
const productionBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "https://executar-ai.vercel.app";
const apiUrl = (path: string) => new URL(path, productionBaseUrl).toString();

test.describe("G2 production smoke", () => {
  test.skip(!runProductionSmoke, "Executado somente no job controlado de homologação em produção.");
  test.setTimeout(60_000);

  test("cria, recarrega, avança, exporta e remove projeto descartável", async ({ page, request }) => {
    const marker = `PW-G2-${Date.now()}`;
    let projectId: string | null = null;

    try {
      await page.goto("/app/");
      await expect(page.getByRole("heading", { name: "Execução em foco." })).toBeVisible();
      await page.getByRole("button", { name: "Portfólio", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Projetos que avançam." })).toBeVisible();

      await page.getByRole("button", { name: /novo projeto/i }).click();
      await page.getByLabel("Nome do projeto").fill(marker);
      await page.getByLabel("Contexto e resultado desejado").fill("Smoke test descartável do ciclo G2 em produção.");
      await page.getByLabel("Responsável").fill("Playwright CI");
      await page.getByRole("button", { name: /criar estrutura/i }).click();

      const markerHeading = page.getByRole("heading", { name: marker });
      const openCreated = page.getByRole("button", { name: `Abrir ${marker}` });
      await expect(markerHeading.or(openCreated)).toBeVisible({ timeout: 20_000 });
      if (await openCreated.isVisible()) await openCreated.click();
      await expect(markerHeading).toBeVisible({ timeout: 20_000 });

      const kicker = page.locator(".project-kicker span");
      projectId = (await kicker.textContent())?.trim() ?? null;
      expect(projectId).toMatch(/^PRJ-/);

      await page.reload();
      await expect(page.getByRole("heading", { name: marker })).toBeVisible({ timeout: 20_000 });

      const firstAction = page.locator(".action-row").filter({ hasText: "T02.1" }).first();
      await firstAction.click();
      await expect(firstAction).toHaveClass(/is-done/);

      await page.reload();
      await expect(page.locator(".action-row.is-done").filter({ hasText: "T02.1" }).first()).toBeVisible({ timeout: 20_000 });

      const exported = await request.get(apiUrl(`/api/executar/projects/${projectId}/export`));
      expect(exported.status()).toBe(200);
      const exportBody = await exported.json() as { data: { progress: Record<string, boolean> } };
      expect(exportBody.data.progress["T02.1"]).toBe(true);
    } finally {
      if (!projectId) {
        const listed = await request.get(apiUrl("/api/executar/projects"));
        if (listed.ok()) {
          const body = await listed.json() as { data?: Array<{ id: string; name: string }> };
          projectId = body.data?.find((project) => project.name === marker)?.id ?? null;
        }
      }

      if (projectId) {
        const removed = await request.delete(apiUrl(`/api/executar/projects/${projectId}`), {
          data: { confirm: true },
        });
        expect(removed.status()).toBe(200);
      }
    }
  });
});
