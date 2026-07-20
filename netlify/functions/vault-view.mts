import type { Config } from "@netlify/functions";
import { baseUrl } from "../../src/lib/env.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService, VaultProblem } from "../../src/lib/vault.mjs";
import { buildVaultBrowserUrl, buildVaultViewUrl, contentTypeFor, isTextFile, renderViewerError } from "../../src/lib/viewer.mjs";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function downloadName(filePath: string): string {
  return filePath.split("/").at(-1) ?? "arquivo";
}

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("path")?.trim();
  const vault = new BlobVaultService(vaultStore());

  try {
    if (!requestedPath) return Response.redirect(buildVaultBrowserUrl(baseUrl()), 302);

    const { record, bytes } = await vault.getFileBytes(requestedPath);
    if (url.searchParams.get("download") === "1") {
      return new Response(bytes, {
        headers: {
          "Content-Type": record.mimeType ?? contentTypeFor(record.path),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName(record.path))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (url.searchParams.get("raw") === "1") {
      if (!isTextFile(record.path, bytes)) return html(renderViewerError(415, "Este arquivo não é texto legível."), 415);
      return new Response(bytes, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(downloadName(record.path))}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return Response.redirect(buildVaultViewUrl(baseUrl(), record.path), 302);
  } catch (error) {
    if (error instanceof VaultProblem) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return html(renderViewerError(status, `${error.message} ${error.suggestion}`), status);
    }
    console.error(error instanceof Error ? error.message : String(error));
    return html(renderViewerError(500, "O visualizador encontrou um erro inesperado."), 500);
  }
};

export const config: Config = { path: "/view" };
