import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

interface FakeReq {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
}

function fakeReq(options: FakeReq & { chunks?: string[] }): IncomingMessage {
  const { chunks = [], ...rest } = options;
  const req = {
    ...rest,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield new TextEncoder().encode(chunk);
    },
  };
  return req as unknown as IncomingMessage;
}

function fakeRes() {
  const state = {
    statusCode: 200,
    headers: new Map<string, string | string[]>(),
    chunks: [] as Uint8Array[],
    ended: false,
    endCallCount: 0,
    headersSent: false,
  };
  const res = {
    get statusCode() { return state.statusCode; },
    set statusCode(value: number) { state.statusCode = value; },
    get headersSent() { return state.headersSent; },
    setHeader(name: string, value: string | string[]) {
      state.headers.set(name.toLowerCase(), value);
    },
    write(chunk: Uint8Array) {
      state.chunks.push(chunk);
    },
    end(final?: unknown) {
      if (typeof final === "string") state.chunks.push(new TextEncoder().encode(final));
      state.ended = true;
      state.endCallCount += 1;
      state.headersSent = true;
    },
  };
  return { res: res as unknown as ServerResponse, state };
}

function bodyText(state: ReturnType<typeof fakeRes>["state"]): string {
  return Buffer.concat(state.chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

describe("createVercelNodeHandler", () => {
  it("builds an absolute URL from x-forwarded-proto/host", async () => {
    let seenUrl = "";
    const handler = createVercelNodeHandler(async (request) => {
      seenUrl = request.url;
      return new Response("ok");
    });
    const { res } = fakeRes();
    await handler(fakeReq({
      method: "GET",
      url: "/api/executar/projects?x=1",
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "executar-ai.vercel.app" },
    }), res);
    expect(seenUrl).toBe("https://executar-ai.vercel.app/api/executar/projects?x=1");
  });

  it("falls back to the host header and https when forwarded headers are absent", async () => {
    let seenUrl = "";
    const handler = createVercelNodeHandler(async (request) => {
      seenUrl = request.url;
      return new Response("ok");
    });
    const { res } = fakeRes();
    await handler(fakeReq({ method: "GET", url: "/health", headers: { host: "example.test" } }), res);
    expect(seenUrl).toBe("https://example.test/health");
  });

  it("preserves the HTTP method", async () => {
    let seenMethod = "";
    const handler = createVercelNodeHandler(async (request) => {
      seenMethod = request.method;
      return new Response(null, { status: 204 });
    });
    const { res } = fakeRes();
    await handler(fakeReq({ method: "delete", url: "/x", headers: {} }), res);
    expect(seenMethod).toBe("DELETE");
  });

  it("converts string, array, and undefined header values", async () => {
    const captured: { headers?: Headers } = {};
    const handler = createVercelNodeHandler(async (request) => {
      captured.headers = request.headers;
      return new Response("ok");
    });
    const { res } = fakeRes();
    await handler(fakeReq({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer abc", cookie: undefined, "x-multi": ["a", "b"] },
    }), res);
    expect(captured.headers?.get("authorization")).toBe("Bearer abc");
    expect(captured.headers?.get("cookie")).toBeNull();
    expect(captured.headers?.get("x-multi")).toContain("a");
  });

  it("reads a JSON body on POST", async () => {
    let seenBody: unknown = null;
    const handler = createVercelNodeHandler(async (request) => {
      seenBody = await request.json();
      return new Response("ok");
    });
    const { res } = fakeRes();
    await handler(fakeReq({
      method: "POST",
      url: "/x",
      headers: { "content-type": "application/json" },
      chunks: ['{"name":"proj"}'],
    }), res);
    expect(seenBody).toEqual({ name: "proj" });
  });

  it("resolves an empty body on POST without a payload", async () => {
    let bodyUsed = true;
    const handler = createVercelNodeHandler(async (request) => {
      bodyUsed = request.body !== null;
      return new Response("ok");
    });
    const { res } = fakeRes();
    await handler(fakeReq({ method: "POST", url: "/x", headers: {} }), res);
    expect(bodyUsed).toBe(false);
  });

  it("does not attempt to read a body for GET or HEAD", async () => {
    let readCalled = false;
    const handler = createVercelNodeHandler(async () => new Response("ok"));
    const { res } = fakeRes();
    const req = fakeReq({ method: "GET", url: "/x", headers: {} });
    Object.defineProperty(req, Symbol.asyncIterator, {
      value: async function* () {
        readCalled = true;
        yield new TextEncoder().encode("should not be read");
      },
    });
    await handler(req, res);
    expect(readCalled).toBe(false);
  });

  it("writes the response status, headers, and body", async () => {
    const handler = createVercelNodeHandler(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json; charset=utf-8", "X-Custom": "yes" },
      }));
    const { res, state } = fakeRes();
    await handler(fakeReq({ method: "POST", url: "/x", headers: {} }), res);
    expect(state.statusCode).toBe(201);
    expect(state.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(state.headers.get("x-custom")).toBe("yes");
    expect(bodyText(state)).toBe(JSON.stringify({ ok: true }));
  });

  it("preserves multiple set-cookie headers", async () => {
    const handler = createVercelNodeHandler(async () => {
      const headers = new Headers();
      headers.append("Set-Cookie", "a=1; Path=/");
      headers.append("Set-Cookie", "b=2; Path=/");
      return new Response(null, { status: 204, headers });
    });
    const { res, state } = fakeRes();
    await handler(fakeReq({ method: "GET", url: "/x", headers: {} }), res);
    expect(state.headers.get("set-cookie")).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("ends the response once for a body-less Response", async () => {
    const handler = createVercelNodeHandler(async () => new Response(null, { status: 204 }));
    const { res, state } = fakeRes();
    await handler(fakeReq({ method: "GET", url: "/x", headers: {} }), res);
    expect(state.endCallCount).toBe(1);
    expect(state.ended).toBe(true);
  });

  it("streams a Response body without ending twice", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("chunk-1"));
        controller.enqueue(new TextEncoder().encode("chunk-2"));
        controller.close();
      },
    });
    const handler = createVercelNodeHandler(async () => new Response(stream, { status: 200 }));
    const { res, state } = fakeRes();
    await handler(fakeReq({ method: "GET", url: "/x", headers: {} }), res);
    expect(bodyText(state)).toBe("chunk-1chunk-2");
    expect(state.endCallCount).toBe(1);
  });

  it("returns a safe 500 JSON envelope when the handler throws, without leaking the error", async () => {
    const handler = createVercelNodeHandler(async () => {
      throw new Error("database password: hunter2");
    });
    const { res, state } = fakeRes();
    await handler(fakeReq({ method: "GET", url: "/x", headers: {} }), res);
    expect(state.statusCode).toBe(500);
    const body = JSON.parse(bodyText(state)) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VERCEL_ADAPTER_ERROR");
    expect(bodyText(state)).not.toContain("hunter2");
  });

  it("does not attempt to write headers again if the response already sent them", async () => {
    const handler = createVercelNodeHandler(async () => {
      throw new Error("late failure");
    });
    const { res, state } = fakeRes();
    state.headersSent = true;
    await handler(fakeReq({ method: "GET", url: "/x", headers: {} }), res);
    expect(state.endCallCount).toBe(1);
  });
});
