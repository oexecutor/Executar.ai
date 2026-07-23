import path from "node:path";
import { requireAdminJson } from "../src/lib/admin-guard.mjs";
import { baseUrl } from "../src/lib/env.mjs";
import { vaultStore } from "../src/lib/stores.mjs";
import { BlobVaultService, normalizeVaultPath, VaultProblem } from "../src/lib/vault.mjs";
import { isDeskOsPath } from "../src/repository/paths.mjs";
import { buildVaultDownloadUrl, buildVaultRawUrl, buildVaultViewUrl, contentTypeFor, isTextFile, renderMarkdown } from "../src/lib/viewer.mjs";
import type { FileRecord } from "../src/lib/types.mjs";

const MAX_EDITOR_BYTES = 1_048_576;

/**
 * DESK-OS operational state (`_desk-os/`) is mutated only through the
 * repository/application services, never by the generic file editor.
 */
function rejectDeskOsWrite(requestedPath: string): void {
  if (isDeskOsPath(normalizeVaultPath(requestedPath))) {
    throw new VaultProblem(
      "RESERVED_PATH",
      "A área _desk-os/ é reservada ao estado operacional do DESK-OS.",
      "Use as ferramentas desk_os_* ou a API /api/pm/* para alterar projetos, sprints e tarefas.",
    );
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function errorStatus(error: VaultProblem): number {
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "CONFLICT") return 409;
  if (error.code === "PROTECTED_PATH") return 403;
  if (error.code === "TOO_LARGE") return 413;
  return 400;
}

function extensionOf(filePath: string): string {
  return path.posix.extname(filePath).toLowerCase();
}

function descriptor(record: FileRecord): Record<string, unknown> {
  const bytes = Buffer.from(record.data, "base64");
  const extension = extensionOf(record.path);
  const text = record.sizeBytes <= MAX_EDITOR_BYTES && isTextFile(record.path, bytes);
  return {
    path: record.path,
    name: path.posix.basename(record.path),
    extension,
    isNote: extension === ".md" || extension === ".markdown",
    isText: text,
    editable: text,
    sizeBytes: record.sizeBytes,
    modifiedAt: record.modifiedAt,
    sha256: record.sha256,
    mimeType: record.mimeType ?? contentTypeFor(record.path).split(";", 1)[0],
    originalName: record.originalName ?? null,
    viewUrl: buildVaultViewUrl(baseUrl(), record.path),
    downloadUrl: buildVaultDownloadUrl(baseUrl(), record.path),
  };
}

async function readFile(vault: BlobVaultService, requestedPath: string): Promise<Record<string, unknown>> {
  const { record, bytes } = await vault.getFileBytes(requestedPath);
  const text = record.sizeBytes <= MAX_EDITOR_BYTES && isTextFile(record.path, bytes);
  const content = text ? Buffer.from(bytes).toString("utf8") : null;
  const extension = extensionOf(record.path);
  return {
    ...descriptor(record),
    content,
    renderedHtml: content !== null && (extension === ".md" || extension === ".markdown")
      ? renderMarkdown(content, record.path, baseUrl())
      : null,
    rawUrl: text ? buildVaultRawUrl(baseUrl(), record.path) : null,
  };
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_EDITOR_BYTES + 65_536) {
    throw new VaultProblem("TOO_LARGE", "O conteúdo ultrapassa o limite do editor.", "Edite arquivos de até 1 MB por vez.");
  }
  const value = await request.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VaultProblem("INVALID_INPUT", "O corpo da requisição precisa ser um objeto JSON.", "Envie path, content e expectedSha256 quando aplicável.");
  }
  return value as Record<string, unknown>;
}

export default async (request: Request): Promise<Response> => {
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  const vault = new BlobVaultService(vaultStore());
  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      const requestedPath = url.searchParams.get("path")?.trim();
      if (requestedPath) return json({ file: await readFile(vault, requestedPath) });

      const records = await vault.allRecords();
      const info = await vault.info();
      return json({ info, entries: records.map(descriptor) });
    }

    if (request.method === "POST") {
      const input = await parseJson(request);
      const notePath = typeof input.path === "string" ? input.path.trim() : "";
      rejectDeskOsWrite(notePath);
      const content = typeof input.content === "string" ? input.content : "";
      if (!notePath.toLowerCase().endsWith(".md")) {
        throw new VaultProblem("INVALID_INPUT", "Novos arquivos criados pelo painel precisam ser notas .md.", "Use um caminho como 00_COMECE_AQUI/Nova nota.md.");
      }
      if (Buffer.byteLength(content, "utf8") > MAX_EDITOR_BYTES) {
        throw new VaultProblem("TOO_LARGE", "A nota ultrapassa o limite do editor.", "Crie uma nota de até 1 MB.");
      }
      await vault.createNote({ path: notePath, content });
      return json({ file: await readFile(vault, notePath) }, 201);
    }

    if (request.method === "PUT") {
      const input = await parseJson(request);
      const requestedPath = typeof input.path === "string" ? input.path.trim() : "";
      rejectDeskOsWrite(requestedPath);
      const content = typeof input.content === "string" ? input.content : null;
      const expectedSha256 = typeof input.expectedSha256 === "string" ? input.expectedSha256 : "";
      if (!requestedPath || content === null) {
        throw new VaultProblem("INVALID_INPUT", "path e content são obrigatórios.", "Leia o arquivo antes de salvá-lo e preserve expectedSha256.");
      }
      if (Buffer.byteLength(content, "utf8") > MAX_EDITOR_BYTES) {
        throw new VaultProblem("TOO_LARGE", "O conteúdo ultrapassa o limite do editor.", "Edite arquivos de até 1 MB por vez.");
      }
      if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new VaultProblem("INVALID_INPUT", "expectedSha256 é obrigatório e precisa ser válido.", "Use o hash retornado pela leitura mais recente.");
      }
      const current = await vault.getFileBytes(requestedPath);
      if (current.record.sizeBytes > MAX_EDITOR_BYTES || !isTextFile(current.record.path, current.bytes)) {
        throw new VaultProblem("INVALID_INPUT", "Este arquivo não pode ser editado como texto no painel.", "Use download para arquivos binários ou maiores que 1 MB.");
      }
      if (requestedPath.toLowerCase().endsWith(".md")) {
        await vault.updateNote({ path: requestedPath, content, mode: "replace", expectedSha256 });
      } else {
        await vault.updateTextFile({ path: requestedPath, content, expectedSha256 });
      }
      return json({ file: await readFile(vault, requestedPath) });
    }

    return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." } }, 405);
  } catch (error) {
    if (error instanceof VaultProblem) {
      return json({ error: { code: error.code, message: error.message, suggestion: error.suggestion } }, errorStatus(error));
    }
    console.error(error instanceof Error ? error.message : String(error));
    return json({ error: { code: "SERVER_ERROR", message: "O navegador do vault encontrou um erro inesperado." } }, 500);
  }
};
