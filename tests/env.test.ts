import { afterEach, describe, expect, it, vi } from "vitest";
import { baseUrl } from "../src/lib/env.js";

function clearBaseUrlEnv(): void {
  vi.stubEnv("PUBLIC_BASE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_ENV", "");
}

describe("baseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the explicit PUBLIC_BASE_URL override", () => {
    clearBaseUrlEnv();
    vi.stubEnv("PUBLIC_BASE_URL", "https://executar.example.com/");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");

    expect(baseUrl()).toBe("https://executar.example.com");
  });

  it("uses the stable project URL in Vercel production", () => {
    clearBaseUrlEnv();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "executar-ai.vercel.app");
    vi.stubEnv("VERCEL_URL", "executar-random.vercel.app");

    expect(baseUrl()).toBe("https://executar-ai.vercel.app");
  });

  it("uses the deployment URL in Vercel previews", () => {
    clearBaseUrlEnv();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "executar-ai.vercel.app");
    vi.stubEnv("VERCEL_URL", "executar-preview-abc.vercel.app");

    expect(baseUrl()).toBe("https://executar-preview-abc.vercel.app");
  });

  it("fails clearly outside Vercel when no public URL is configured", () => {
    clearBaseUrlEnv();

    expect(() => baseUrl()).toThrow("PUBLIC_BASE_URL");
  });
});
