import { z } from "zod";
import { absoluteUrl, json, methodNotAllowed } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

const MAX_BODY_BYTES = 4_096;
const MIN_FORM_AGE_MS = 1_000;

const subscriptionSchema = z.object({
  email: z.string().trim().email().max(254),
  website: z.string().max(200).optional().default(""),
  consent: z.literal(true),
  source: z.literal("executa-blog"),
  started_at: z.number().int().positive(),
}).strict();

function response(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return json(body, { ...init, headers });
}

function requestOrigin(request: Request): string | null {
  if (/^https?:\/\//i.test(request.url)) return new URL(request.url).origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set<string>();
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // A malformed deployment variable must not make the endpoint permissive.
    }
  }
  const current = requestOrigin(request);
  if (current) allowed.add(current);
  return allowed.has(origin);
}

async function readBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function subscribe(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return response({
      ok: false,
      error: { code: "ORIGIN_FORBIDDEN", message: "Origem da solicitação não permitida." },
    }, { status: 403 });
  }

  let input: unknown;
  try {
    input = await readBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
    return response({
      ok: false,
      error: {
        code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message: tooLarge ? "Solicitação muito grande." : "Corpo JSON inválido.",
      },
    }, { status: tooLarge ? 413 : 400 });
  }

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return response({
      ok: false,
      error: {
        code: "INVALID_SUBSCRIPTION",
        message: "Informe um e-mail válido e confirme o consentimento.",
      },
    }, { status: 422 });
  }

  // Honeypots receive a generic success so automated submissions get no signal.
  if (parsed.data.website) return response({ ok: true, data: { accepted: true } });

  const formAge = Date.now() - parsed.data.started_at;
  if (formAge < MIN_FORM_AGE_MS || formAge > 86_400_000) {
    return response({
      ok: false,
      error: {
        code: "FORM_TIMING_INVALID",
        message: "Atualize a página e tente novamente.",
      },
    }, { status: 422 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRole) {
    return response({
      ok: false,
      error: {
        code: "NEWSLETTER_NOT_CONFIGURED",
        message: "A newsletter ainda não está disponível.",
      },
    }, { status: 503 });
  }

  const auditId = crypto.randomUUID();
  const upstream = await fetch(`${supabaseUrl}/rest/v1/rpc/subscribe_newsletter`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_email: parsed.data.email.toLowerCase(),
      target_source: parsed.data.source,
      target_audit_id: auditId,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!upstream.ok) {
    console.error(`NEWSLETTER_RPC_FAILED:${upstream.status}`);
    return response({
      ok: false,
      error: {
        code: "NEWSLETTER_UNAVAILABLE",
        message: "Não foi possível concluir sua inscrição agora.",
      },
    }, { status: 503 });
  }

  return response({ ok: true, data: { accepted: true, audit_id: auditId } }, { status: 201 });
}

async function blogHandler(request: Request): Promise<Response> {
  const pathname = absoluteUrl(request).pathname;
  if (pathname !== "/api/blog" && pathname !== "/api/blog/newsletter") {
    return response({
      ok: false,
      error: { code: "NOT_FOUND", message: "Rota editorial inexistente." },
    }, { status: 404 });
  }
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  try {
    return await subscribe(request);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return response({
      ok: false,
      error: {
        code: "NEWSLETTER_UNAVAILABLE",
        message: "Não foi possível concluir sua inscrição agora.",
      },
    }, { status: 503 });
  }
}

export { blogHandler };
export default createVercelNodeHandler(blogHandler);
