import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    // Pre-installed browser in this environment; avoids downloading a
    // fresh chromium_headless_shell revision that may not match the
    // pinned @playwright/test version.
    launchOptions: { executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] },
  },
});
