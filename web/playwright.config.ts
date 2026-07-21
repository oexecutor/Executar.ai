import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Some sandboxed dev environments ship a pre-installed chromium at this
// fixed path and block downloading a fresh one; CI (and most local setups)
// don't have it and rely on `playwright install` populating the normal
// ~/.cache/ms-playwright instead. Only override when that path is actually
// present, so CI keeps using Playwright's own browser resolution.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    launchOptions: { executablePath, args: ["--no-sandbox"] },
  },
});
