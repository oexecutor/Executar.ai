import { describe, expect, it } from "vitest";
import { absoluteUrl, withAbsoluteRequestUrl } from "../src/lib/http.js";

/**
 * Production incident: Netlify's Request.url was always absolute; Vercel's
 * Node.js function runtime hands handlers a Request whose .url is relative
 * (e.g. "/api/vault/files"), which made every `new URL(request.url)` call
 * across the api/* handlers throw `TypeError: Invalid URL` at runtime —
 * something our other tests never caught because they all construct
 * `new Request("https://example.test/...")` with an absolute URL, matching
 * Netlify's shape rather than Vercel's. These tests exercise the relative
 * shape directly, duck-typing a Request-like object since the real Request
 * constructor itself rejects a bare relative URL string.
 */

function relativeRequest(url: string, init: { method?: string; headers?: HeadersInit; body?: BodyInit | null } = {}): Request {
  return { url, method: init.method ?? "GET", headers: new Headers(init.headers), body: init.body ?? null } as unknown as Request;
}

describe("absoluteUrl", () => {
  it("parses a relative request.url (the shape Vercel provides) without throwing", () => {
    const url = absoluteUrl(relativeRequest("/api/vault/files?path=notes%2Fa.md"));
    expect(url.pathname).toBe("/api/vault/files");
    expect(url.searchParams.get("path")).toBe("notes/a.md");
  });

  it("still works when request.url is already absolute (the shape Netlify provided)", () => {
    const url = absoluteUrl(new Request("https://example.test/oauth/register"));
    expect(url.pathname).toBe("/oauth/register");
  });
});

describe("withAbsoluteRequestUrl", () => {
  it("rewrites a relative-URL request into one the real Request/URL constructors accept", () => {
    const fixed = withAbsoluteRequestUrl(relativeRequest("/mcp", { method: "POST", headers: { "content-type": "application/json" } }));
    expect(() => new URL(fixed.url)).not.toThrow();
    expect(fixed.method).toBe("POST");
    expect(fixed.headers.get("content-type")).toBe("application/json");
  });

  it("passes an already-absolute request through unchanged", () => {
    const original = new Request("https://example.test/mcp", { method: "GET" });
    expect(withAbsoluteRequestUrl(original)).toBe(original);
  });
});
