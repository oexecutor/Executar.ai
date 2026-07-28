import { expect, test, type Page } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import type { EditorialPublication } from "../src/editorial/types";
import { blogPosts } from "../src/blog/content";
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

function editorialAdapter(adapter: "deskgo" | "frankwatching" | "ames", applied = false) {
  return {
    adapter,
    status: applied ? "APPLIED" : "NOT_RUN",
    adapter_version: applied ? "1.0.0" : null,
    publication_version: 1,
    content_hash: applied ? "a".repeat(64) : null,
    started_at: applied ? "2026-07-28T01:01:00.000Z" : null,
    completed_at: applied ? "2026-07-28T01:01:01.000Z" : null,
    findings: { errors: [], warnings: [], recommendations: [] },
    output_reference: applied ? `editorial://e2e/${adapter}` : null,
    actor: applied ? "Leonardo Batista" : null,
    skip_reason: null,
  };
}

function editorialPublication() {
  return {
    id: "PUB-20260728-e2e",
    version: 1,
    status: "DRAFT",
    briefing: {
      title: "Pacote editorial antes do Preview",
      summary: "Valida o gate interno da E1.",
      audience: "Equipe editorial",
      objective: "Impedir Preview sem pacote aprovado.",
      author: "Leonardo Batista",
      source_text: "# Pacote editorial antes do Preview\n\nEste conteúdo de homologação comprova que o fluxo exige um pacote editorial válido antes de registrar qualquer artefato externo.\n\n## Gate obrigatório\n\nA próxima ação é executar as regras internas e iniciar a E2 oficial.",
      keywords: ["E1", "E2"],
      channel: "EXECUTA_JOURNAL",
      language: "pt-BR",
    },
    content: {
      slug: "criterios-editoriais-antes-do-preview",
      excerpt: "Valida o gate interno da E1.",
      markdown: "# Pacote editorial antes do Preview\n\nEste conteúdo de homologação comprova que o fluxo exige um pacote editorial válido antes de registrar qualquer artefato externo.\n\n## Gate obrigatório\n\nA próxima ação é executar as regras internas e iniciar a E2 oficial.",
      reading_time_minutes: 1,
      generated_at: null,
      updated_at: "2026-07-28T01:00:00.000Z",
    },
    quality: {
      valid: false,
      gate_result: "NOT_RUN",
      score: null,
      errors: [],
      warnings: [],
      checked_at: null,
      content_hash: null,
      adapters: {
        deskgo: editorialAdapter("deskgo"),
        frankwatching: editorialAdapter("frankwatching"),
        ames: editorialAdapter("ames"),
      },
    },
    github: {
      branch: null,
      pull_request_number: null,
      pull_request_url: null,
      commit_sha: null,
      publication_version: null,
      content_hash: null,
      artifact_contract_version: null,
      artifact_paths: [],
      created_at: null,
    },
    preview: { deployment_id: null, url: null, created_at: null, commit_sha: null },
    approval: { decision: "PENDING", reviewer: null, note: null, decided_at: null, approved_commit_sha: null },
    publication: { url: null, published_at: null, commit_sha: null },
    qr: {
      create_url: null,
      preview_url: null,
      approve_url: null,
      analytics_url: null,
      routes: { CREATE: null, PREVIEW: null, APPROVE: null, ANALYTICS: null },
      issued_at: null,
    },
    events: [{ id: "evt-e2e", type: "CREATED", at: "2026-07-28T01:00:00.000Z", actor: "Leonardo Batista", detail: "Briefing editorial criado." }],
    created_at: "2026-07-28T01:00:00.000Z",
    updated_at: "2026-07-28T01:00:00.000Z",
  };
}

test.describe("EXECUTA.AI — acesso sem login", () => {
  test("raiz exibe a landing pública e mantém o workspace separado", async ({ page }) => {
    const failures = trackFailures(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Contexto complexo/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Entrar/ })).toBeVisible();
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

test.describe("EXECUTA.AI — E1 e E2 editoriais", () => {
  test("fecha a E1 com regras internas e libera a automação oficial da E2", async ({ page }) => {
    const failures = trackFailures(page);
    let current = editorialPublication() as EditorialPublication;

    await page.route("**/api/editorial/publications**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() === "GET" && pathname.endsWith("/publications")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: [{
              id: current.id,
              title: current.briefing.title,
              slug: current.content.slug,
              status: current.status,
              version: current.version,
              preview_url: null,
              publication_url: null,
              updated_at: current.updated_at,
            }],
          }),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/quality/rules/run")) {
        current = {
          ...current,
          status: "ADAPTERS_APPLIED",
          quality: {
            ...current.quality,
            adapters: {
              deskgo: editorialAdapter("deskgo", true),
              frankwatching: editorialAdapter("frankwatching", true),
              ames: editorialAdapter("ames", true),
            },
          },
        };
      } else if (request.method() === "POST" && pathname.endsWith("/validate")) {
        current = {
          ...current,
          status: "READY_FOR_PREVIEW",
          quality: {
            ...current.quality,
            valid: true,
            gate_result: "PASSED",
            score: 92,
            checked_at: "2026-07-28T01:02:00.000Z",
            content_hash: "a".repeat(64),
          },
        };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: current, warnings: [], request_id: "req_e2e" }),
      });
    });

    await page.goto("/app/");
    await page.getByRole("button", { name: "Editorial" }).click();
    await expect(page.getByRole("heading", { name: current.briefing.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Executar", exact: true })).toHaveCount(3);
    await expect(page.getByText(/não executam Desk&Go, Frankwatching nem AMES/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Executar gate interno da E1/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Executar todas as regras internas" }).click();
    await page.getByRole("button", { name: /Executar gate interno da E1/ }).click();
    await expect(page.getByRole("heading", { name: "Criar branch, commit, PR e Preview" })).toBeVisible();
    await expect(page.getByText(/E1 concluída — pacote liberado/)).toBeVisible();
    await expect(page.getByLabel("Branch")).toHaveCount(0);
    await expect(page.getByLabel("Commit SHA")).toHaveCount(0);
    expect(failures.errors).toEqual([]);
    await assertNoSeriousAccessibilityViolations(page);
  });
});

test.describe("EXECUTA.AI — E4 QR semântico P0", () => {
  test("emite quatro rotas estáveis e abre aprovação apenas como contexto no mobile", async ({ page }) => {
    const failures = trackFailures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    let current = editorialPublication();
    current = {
      ...current,
      status: "PUBLISHED",
      publication: {
        url: "https://executar-ai.vercel.app/blog/qr-semantico",
        published_at: "2026-07-28T14:00:00.000Z",
        commit_sha: "b".repeat(40),
      },
    };
    const actions = ["CREATE", "PREVIEW", "APPROVE", "ANALYTICS"] as const;

    await page.route("**/api/editorial/publications**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() === "GET" && pathname.endsWith("/publications")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: [{
              id: current.id,
              title: current.briefing.title,
              slug: current.content.slug,
              status: current.status,
              version: current.version,
              preview_url: current.preview.url,
              publication_url: current.publication.url,
              updated_at: current.updated_at,
            }],
          }),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/qr")) {
        const routes = Object.fromEntries(actions.map((action, index) => {
          const token = `qr_${String.fromCharCode(65 + index).repeat(24)}`;
          return [action, {
            action,
            token,
            url: `http://localhost:${PORT}/q/${token}`,
            status: "ACTIVE",
            access_policy: action === "PREVIEW"
              ? "PUBLIC_REDIRECT"
              : "AUTHENTICATED_CONTEXT",
            issued_at: "2026-07-28T14:01:00.000Z",
            issued_by: "Leonardo Batista",
          }];
        })) as EditorialPublication["qr"]["routes"];
        current = {
          ...current,
          qr: {
            create_url: routes.CREATE.url,
            preview_url: routes.PREVIEW.url,
            approve_url: routes.APPROVE.url,
            analytics_url: routes.ANALYTICS.url,
            routes,
            issued_at: "2026-07-28T14:01:00.000Z",
          },
        };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: current,
          warnings: [],
          request_id: "req_e4_e2e",
        }),
      });
    });

    await page.route("**/q/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith(".svg")) {
        await route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
        });
        return;
      }
      await route.fulfill({
        status: 302,
        headers: {
          location: `http://localhost:${PORT}/app/?tab=editorial&publication=${current.id}&intent=approve`,
        },
      });
    });

    await page.goto("/app/?tab=editorial");
    await expect(page.getByRole("heading", { name: current.briefing.title })).toBeVisible();
    await page.getByRole("button", { name: /Emitir quatro QRs semânticos/ }).click();
    await expect(page.getByRole("img", { name: "QR-01 — Criar / Processar" })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR-04 — Medir" })).toBeVisible();
    await expect(page.getByRole("link", {
      name: "Continuar tarefa atual neste dispositivo.",
    })).toHaveCount(4);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
    await assertNoSeriousAccessibilityViolations(page);

    await page.locator(".editorial-qr-card")
      .filter({ hasText: "QR-03" })
      .getByRole("link", {
        name: "Continuar tarefa atual neste dispositivo.",
      })
      .click();
    await expect(page).toHaveURL(/intent=approve/);
    await expect(page.getByText(/Escanear não aprova, não faz merge e não publica/)).toBeVisible();
    await expect(page.getByRole("heading", { name: current.briefing.title })).toBeVisible();
    expect(failures.errors).toEqual([]);
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
    // O total de slides no carrossel é derivado da mesma fonte que o app usa
    // (todos os posts exceto o featured, ver BlogIndex.tsx) em vez de um
    // número fixo — evita quebrar sempre que um artigo é publicado ou
    // removido.
    const carouselTotal = blogPosts.filter((post) => !post.featured).length;
    const totalLabel = carouselTotal.toString().padStart(2, "0");
    const status = page.locator(".blog-carousel-status span");
    await expect(status).toHaveText(`01 / ${totalLabel}`);
    await page.getByRole("button", { name: "Próximo artigo" }).click();
    await expect(status).toHaveText(`02 / ${totalLabel}`);

    const region = page.getByRole("region", { name: "Artigos em carrossel" });
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText(`03 / ${totalLabel}`);
    await page.keyboard.press("ArrowLeft");
    await expect(status).toHaveText(`02 / ${totalLabel}`);
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
    await expect(page.getByRole("heading", { name: "Contexto complexo. Próxima ação clara." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto("/app/");
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
