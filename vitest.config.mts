import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // web/ is a separate sub-project with its own vitest.config.ts (jsdom
    // environment, React Testing Library) and its own `npm test` — without
    // this, vitest's default recursive glob picks up web/src/**/*.test.tsx
    // here too, but runs them in the wrong (node) environment.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "web/**",
    ],
  },
});
