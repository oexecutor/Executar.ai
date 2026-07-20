import { requireAdmin } from "../../src/lib/auth.mjs";
import { json, methodNotAllowed, safeError, VaultProblem } from "../../src/lib/http.mjs";
import { activeVault } from "../../src/lib/vault-instance.mjs";
import { normalizeVaultPath } from "../../src/lib/vault.mjs";

/**
 * DESK-OS operational state is written only through the repository layer;
 * the generic file API must not edit it directly.
 */
const RESERVED_PREFIX = "_desk-os";

function rejectReserved(path: string): void {
  const normalized = normalizeVaultPath(path);
  if (normalized === RESERVED_PREFIX || normalized.startsWith(RESERVED_PREFIX + "/")) {
    throw new VaultProblem(
      "reserved_path",
      `"${RESERVED_PREFIX}/" is reserved for DESK-OS operational state.`,
      "Use the DESK-OS API or MCP tools instead.",
      403,
    );
  }
}

interface WriteBody {
  path?: unknown;
  content?: unknown;
  expectedSha256?: unknown;
}

function parseWriteBody(body: WriteBody): { path: string; content: string; expectedSha256?: string } {
  if (typeof body.path !== "string" || typeof body.content !== "string") {
    throw new VaultProblem("invalid_request", "Body must include string fields `path` and `content`.");
  }
  if (body.expectedSha256 !== undefined && typeof body.expectedSha256 !== "string") {
    throw new VaultProblem("invalid_request", "`expectedSha256` must be a string when present.");
  }
  return {
    path: body.path,
    content: body.content,
    expectedSha256: body.expectedSha256 as string | undefined,
  };
}

export default async function handler(request: Request): Promise<Response> {
  try {
    await requireAdmin(request);
    const vault = activeVault();
    const url = new URL(request.url);

    if (request.method === "GET") {
      const path = url.searchParams.get("path");
      if (path) {
        rejectReserved(path);
        const record = await vault.requireRecord(path);
        return json({ file: record });
      }
      const prefix = url.searchParams.get("prefix") ?? undefined;
      if (prefix) rejectReserved(prefix);
      const paths = (await vault.listPaths(prefix)).filter(
        (p) => p !== RESERVED_PREFIX && !p.startsWith(RESERVED_PREFIX + "/"),
      );
      return json({ paths });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = parseWriteBody((await request.json().catch(() => ({}))) as WriteBody);
      rejectReserved(body.path);
      const existing = await vault.getRecord(body.path);
      if (request.method === "POST" && existing) {
        throw new VaultProblem(
          "already_exists",
          `File "${body.path}" already exists.`,
          "Use PUT with expectedSha256 to edit it.",
          409,
        );
      }
      if (request.method === "PUT" && !existing) {
        throw new VaultProblem("not_found", `No file at "${body.path}".`, "Create it with POST.", 404);
      }
      const record = await vault.putText(body.path, body.content, {
        expectedSha256: body.expectedSha256,
        overwriteToTrash: request.method === "PUT",
      });
      return json({ file: record }, { status: request.method === "POST" ? 201 : 200 });
    }

    return methodNotAllowed(["GET", "POST", "PUT"]);
  } catch (err) {
    return safeError(err);
  }
}
