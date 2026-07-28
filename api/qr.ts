import QRCode from "qrcode";
import { createEditorialSqlClient } from "../src/editorial/postgres-store.js";
import { buildEditorialQrUrl, resolveEditorialQrDestination, type EditorialQrResolverRepository } from "../src/editorial/qr.js";
import { PostgresEditorialQrStore } from "../src/editorial/qr-store.js";
import { baseUrl, isProduction } from "../src/lib/env.js";
import { absoluteUrl, html, methodNotAllowed } from "../src/lib/http.js";
import { createVercelNodeHandler } from "../src/lib/vercel-node-adapter.js";

function defaultResolver(): EditorialQrResolverRepository {
  return new PostgresEditorialQrStore(
    createEditorialSqlClient(),
    isProduction() ? "production" : "preview",
  );
}

let resolverFactory: () => EditorialQrResolverRepository = defaultResolver;

export function setEditorialQrResolverForTesting(
  factory: (() => EditorialQrResolverRepository) | null,
): void {
  resolverFactory = factory ?? defaultResolver;
}

function problem(
  status: number,
  title: string,
  detail: string,
): Response {
  return html(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{max-width:42rem;margin:0 auto;padding:3rem 1.25rem;background:#f5f2ec;color:#171717;font:16px/1.5 system-ui,sans-serif}h1{font-size:clamp(2rem,8vw,4rem);line-height:.95}a{display:inline-block;margin-top:1rem;padding:.8rem 1rem;background:#171717;color:#fff;font-weight:700;text-decoration:none}</style><main><p>EXECUTA.AI · QR SEMÂNTICO</p><h1>${title}</h1><p>${detail}</p><a href="/app/?tab=editorial">Abrir painel editorial</a></main></html>`,
    { status },
  );
}

function requestedToken(request: Request): {
  token: string;
  svg: boolean;
} {
  const url = absoluteUrl(request);
  const fromQuery = url.searchParams.get("token")?.trim();
  const fromPath = url.pathname.match(/^\/q\/([^/]+)$/)?.[1];
  const encoded = fromQuery || fromPath || "";
  const decoded = decodeURIComponent(encoded);
  return decoded.endsWith(".svg")
    ? { token: decoded.slice(0, -4), svg: true }
    : { token: decoded, svg: false };
}

async function qrHandler(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const { token, svg } = requestedToken(request);
  const repository = resolverFactory();
  const resolved = await repository.resolveRoute(token);
  if (!resolved) {
    return problem(
      404,
      "QR não encontrado",
      "Este código não corresponde a uma rota editorial ativa.",
    );
  }
  if (resolved.registration.status === "REVOKED") {
    await repository.recordAccess(token, "REVOKED", new Date().toISOString());
    return problem(
      410,
      "QR desativado",
      "Abra o painel editorial para obter o caminho atual.",
    );
  }

  if (svg) {
    const routeUrl = buildEditorialQrUrl(baseUrl(), token);
    const image = await QRCode.toString(routeUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 512,
      color: { dark: "#111111", light: "#ffffff" },
    });
    return new Response(image, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }

  const destination = resolveEditorialQrDestination(baseUrl(), resolved);
  await repository.recordAccess(
    token,
    destination.outcome,
    new Date().toISOString(),
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export { qrHandler };
export default createVercelNodeHandler(qrHandler);
