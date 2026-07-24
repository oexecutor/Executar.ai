import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blogHandler } from "../api/blog.js";

const ENDPOINT = "https://executa.test/api/blog/newsletter";

function request(body: unknown, origin = "https://executa.test"): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: "Pessoa@Example.com",
    website: "",
    consent: true,
    source: "executa-blog",
    started_at: Date.now() - 5_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("PUBLIC_BASE_URL", "https://executa.test");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-role");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/blog/newsletter", () => {
  it("permite apenas POST", async () => {
    const response = await blogHandler(new Request(ENDPOINT));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("recusa origens diferentes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await blogHandler(request(validInput(), "https://evil.example"));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valida e-mail e consentimento antes de gravar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await blogHandler(request(validInput({ email: "não-é-email", consent: false })));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita silenciosamente o honeypot sem consultar o banco", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await blogHandler(request(validInput({ website: "https://bot.example" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { accepted: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa envio automatizado rápido demais", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await blogHandler(request(validInput({ started_at: Date.now() })));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grava por RPC com service role somente no servidor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify("11111111-1111-1111-1111-111111111111"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await blogHandler(request(validInput()));
    expect(response.status).toBe(201);
    const result = await response.json() as { ok: boolean; data: { audit_id: string } };
    expect(result.ok).toBe(true);
    expect(result.data.audit_id).toMatch(/^[0-9a-f-]{36}$/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/rest/v1/rpc/subscribe_newsletter");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer server-only-service-role");
    expect(JSON.parse(String(init.body))).toMatchObject({
      target_email: "pessoa@example.com",
      target_source: "executa-blog",
      target_audit_id: result.data.audit_id,
    });
  });

  it("não expõe detalhes quando o Supabase falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret database detail", { status: 500 })));
    const response = await blogHandler(request(validInput()));
    expect(response.status).toBe(503);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("secret database detail");
    expect(serialized).toContain("NEWSLETTER_UNAVAILABLE");
  });
});
