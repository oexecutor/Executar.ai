type WebHandler = (request: Request) => Response | Promise<Response>;

type HeaderValue = string | string[] | undefined;

function firstHeader(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: any): Promise<BodyInit | undefined> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string" || req.body instanceof Uint8Array) {
      return req.body as BodyInit;
    }
    return JSON.stringify(req.body);
  }

  if (typeof req?.[Symbol.asyncIterator] !== "function") return undefined;

  const chunks: Uint8Array[] = [];
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
    chunks.push(
      typeof chunk === "string"
        ? new TextEncoder().encode(chunk)
        : new Uint8Array(chunk),
    );
  }

  if (!chunks.length) return undefined;

  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged as BodyInit;
}

async function toWebRequest(req: any): Promise<Request> {
  const rawHeaders: Record<string, HeaderValue> = req.headers ?? {};
  const headers = new Headers();

  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, String(value));
    }
  }

  const protocol = firstHeader(rawHeaders["x-forwarded-proto"]) ?? "https";
  const host =
    firstHeader(rawHeaders["x-forwarded-host"]) ??
    firstHeader(rawHeaders.host) ??
    "localhost";

  const url = new URL(req.url ?? "/", `${protocol}://${host}`).toString();
  const method = String(req.method ?? "GET").toUpperCase();
  const init: RequestInit & { duplex?: "half" } = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    const body = await readBody(req);
    if (body !== undefined) init.body = body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function writeNodeResponse(response: Response, res: any): Promise<void> {
  res.statusCode = response.status;

  const responseHeaders: any = response.headers;
  if (typeof responseHeaders.getSetCookie === "function") {
    const cookies = responseHeaders.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export function createVercelNodeHandler(webHandler: WebHandler) {
  return async function vercelNodeHandler(req: any, res: any): Promise<void> {
    try {
      const request = await toWebRequest(req);
      const response = await webHandler(request);
      await writeNodeResponse(response, res);
    } catch (error) {
      console.error("Vercel adapter failure", error);

      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
      }

      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "VERCEL_ADAPTER_ERROR",
            message: "Falha interna ao processar a requisição.",
          },
        }),
      );
    }
  };
}
