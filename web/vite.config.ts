import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds into public/app/ so the existing public/index.html (the vault
// browser, DEC-002: stays stable) is untouched — this is a net-new
// addition served alongside it, not a migration.
export default defineConfig({
  plugins: [react()],
  base: "/app/",
  build: {
    outDir: "../public/app",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
