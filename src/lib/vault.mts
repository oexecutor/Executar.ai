import crypto from "node:crypto";
import path from "node:path";
import type { KvStore as Store } from "./kv-store.mjs";
import { parse, stringify } from "yaml";
import type { FileRecord, TrashRecord } from "./types.mjs";

const FILE_PREFIX = "file/";
const TRASH_PREFIX = "trash/";
const ALWAYS_PROTECTED = new Set([".obsidian", ".git", ".mcp-trash"]);
const MAX_READ_BYTES = 1_048_576;
const MAX_SEARCH_FILES = 2_000;
const MAX_SEARCH_RESULTS = 100;
const MAX_REGEX_PATTERN_LENGTH = 200;
const MAX_REGEX_LINE_CHARS = 2_000;
const MAX_SEARCH_MILLIS = 4_000;

/**
 * Rejects the two textbook catastrophic-backtracking shapes:
 *   1. a quantified group that itself contains a quantifier, e.g.
 *      `(a+)+`, `(a*)+`, `([a-z]+)*`;
 *   2. a quantified group containing alternation, e.g. `(a|a)+`, `(a|ab)*`
 *      — ambiguous branches let the engine explore exponentially many
 *      ways to split the same input across repetitions.
 * This is a heuristic, not a full static analyzer — it blocks the exploit
 * shapes behind most real ReDoS reports without needing a regex-parser
 * dependency. Combined with the pattern-length cap, per-line input cap,
 * and time budget below, it keeps `obsidian_search_notes`'s regex mode
 * from hanging a function invocation (baseline §11.1).
 */
const NESTED_QUANTIFIER_PATTERN = /\([^()]*[+*][^()]*\)[+*{]/;
const QUANTIFIED_ALTERNATION_PATTERN = /\([^()]*\|[^()]*\)[+*{]/;

function assertSafeRegexPattern(pattern: string): void {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new VaultProblem(
      "INVALID_REGEX",
      `Regular expressions are limited to ${MAX_REGEX_PATTERN_LENGTH} characters.`,
      "Narrow the pattern or search with regex=false for literal text.",
    );
  }
  if (NESTED_QUANTIFIER_PATTERN.test(pattern) || QUANTIFIED_ALTERNATION_PATTERN.test(pattern)) {
    throw new VaultProblem(
      "UNSAFE_REGEX",
      "This pattern can cause catastrophic backtracking.",
      "Avoid a quantified group that contains another quantifier or alternation, e.g. rewrite (a+)+ as a+ and (a|ab)+ as a+b?.",
    );
  }
}
export const MAX_BINARY_IMPORT_BYTES = 4_000_000;

export class VaultProblem extends Error {
  constructor(public readonly code: string, message: string, public readonly suggestion: string) {
    super(message);
  }
}

function digest(buffer: Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}


function normalizeMimeType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized) || normalized.length > 200) {
    throw new VaultProblem("INVALID_INPUT", "Invalid MIME type.", "Use a value such as application/zip or application/pdf.");
  }
  return normalized;
}

function decodeBase64Payload(input: string): { bytes: Uint8Array; inferredMimeType?: string } {
  if (typeof input !== "string" || !input.trim()) {
    throw new VaultProblem("INVALID_INPUT", "Binary content is empty.", "Provide the file bytes encoded as base64.");
  }
  let payload = input.trim();
  let inferredMimeType: string | undefined;
  const dataUrl = payload.match(/^data:([^;,]+)?;base64,([\s\S]+)$/i);
  if (dataUrl) {
    inferredMimeType = normalizeMimeType(dataUrl[1]);
    payload = dataUrl[2] ?? "";
  }
  const compact = payload.replace(/\s+/g, "");
  if (!compact || !/^[A-Za-z0-9+/_=-]+$/.test(compact)) {
    throw new VaultProblem("INVALID_BASE64", "Binary content is not valid base64.", "Send raw base64 or a data URL ending in ;base64,...");
  }
  const standard = compact.replaceAll("-", "+").replaceAll("_", "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  const bytes = Buffer.from(padded, "base64");
  const canonicalInput = standard.replace(/=+$/, "");
  const canonicalDecoded = Buffer.from(bytes).toString("base64").replace(/=+$/, "");
  if (canonicalDecoded !== canonicalInput) {
    throw new VaultProblem("INVALID_BASE64", "Binary content failed base64 validation.", "Re-encode the original bytes without modifying them.");
  }
  if (bytes.byteLength > MAX_BINARY_IMPORT_BYTES) {
    throw new VaultProblem("TOO_LARGE", `Binary file exceeds the ${MAX_BINARY_IMPORT_BYTES}-byte MCP import limit.`, "Use a smaller ZIP or the dashboard ZIP importer for larger packages.");
  }
  return { bytes, inferredMimeType };
}

function fileKey(relativePath: string): string {
  return `${FILE_PREFIX}${encodeURIComponent(relativePath)}`;
}

function trashKey(trashId: string): string {
  return `${TRASH_PREFIX}${trashId}`;
}

function decodeData(record: FileRecord): Uint8Array {
  return Buffer.from(record.data, "base64");
}

function textContent(record: FileRecord): string {
  const bytes = decodeData(record);
  if (bytes.includes(0)) throw new VaultProblem("NOT_TEXT", `${record.path} appears to be binary.`, "List, move, copy, trash, or export binary files instead of reading them as text.");
  return Buffer.from(bytes).toString("utf8");
}

function parseNote(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { frontmatter: {}, body: content };
  const value = parse(match[1] ?? "");
  if (value !== null && (typeof value !== "object" || Array.isArray(value))) {
    throw new VaultProblem("INVALID_FRONTMATTER", "YAML frontmatter must be an object.", "Correct the YAML properties and retry.");
  }
  return { frontmatter: (value ?? {}) as Record<string, unknown>, body: content.slice(match[0].length) };
}

function serializeNote(frontmatter: Record<string, unknown>, body: string): string {
  if (Object.keys(frontmatter).length === 0) return body;
  return `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n${body}`;
}

export function normalizeVaultPath(input: string): string {
  if (typeof input !== "string" || input.includes("\0")) {
    throw new VaultProblem("INVALID_PATH", "Path must be a valid string.", "Use a vault-relative path without null bytes.");
  }
  const unix = input.replaceAll("\\", "/").replace(/^\.\//, "");
  if (path.posix.isAbsolute(unix) || /^[A-Za-z]:\//.test(unix)) {
    throw new VaultProblem("INVALID_PATH", "Absolute paths are not allowed.", "Use a path relative to the vault root.");
  }
  const normalized = path.posix.normalize(unix).replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new VaultProblem("INVALID_PATH", "A non-root path inside the vault is required.", "Choose a note, file, or folder inside the vault.");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.startsWith(".") || ALWAYS_PROTECTED.has(segment))) {
    throw new VaultProblem("PROTECTED_PATH", "Hidden and Obsidian-internal paths are protected.", "Use ordinary content paths outside .obsidian, .git, and hidden folders.");
  }
  if (Buffer.byteLength(fileKey(normalized)) > 600) {
    throw new VaultProblem("PATH_TOO_LONG", "Encoded path exceeds the storage limit.", "Shorten folder and file names.");
  }
  return normalized;
}

/**
 * Vault-relative prefix reserved for DESK-OS PM operational state
 * (src/repository/vault-adapter.mts writes projects/sprints/tasks/evidence
 * there). Mirrored in src/repository/paths.mts as DESK_OS_ROOT; a test in
 * tests/reserved-path-guard.test.ts asserts the two never drift apart.
 *
 * Kept separate from ALWAYS_PROTECTED because that set also blocks READS
 * (`.obsidian`, `.git`, `.mcp-trash` are private editor internals); reading
 * `_desk-os/` stays allowed (it is admin/OAuth-gated structured PM data,
 * not secret), only WRITES/MOVES/DELETES to it are blocked here unless the
 * caller explicitly opts in.
 */
const DESK_OS_RESERVED_PREFIX = "_desk-os";

function isReservedSystemPath(normalizedPath: string): boolean {
  return normalizedPath === DESK_OS_RESERVED_PREFIX || normalizedPath.startsWith(`${DESK_OS_RESERVED_PREFIX}/`);
}

export class BlobVaultService {
  constructor(
    private readonly store: Store,
    private readonly options: { allowReservedPaths?: boolean } = {},
  ) {}

  /**
   * Every write/move/delete primitive funnels through here. Blocks mutation
   * of the reserved DESK-OS prefix unless the caller was constructed with
   * `allowReservedPaths: true` (only src/repository/vault-adapter.mts does
   * this) — so the legacy obsidian_ and desk_ MCP tools, vault-import, and
   * the generic vault-files HTTP API can never create, edit, move, or
   * delete DESK-OS PM state and bypass its index/audit/idempotency
   * guarantees.
   */
  private assertWritable(normalizedPath: string): void {
    if (!this.options.allowReservedPaths && isReservedSystemPath(normalizedPath)) {
      throw new VaultProblem(
        "PROTECTED_PATH",
        `"${DESK_OS_RESERVED_PREFIX}/" is reserved for DESK-OS PM operational state.`,
        "Use the desk_os_* MCP tools or the /api/pm/* HTTP API instead of raw vault writes.",
      );
    }
  }

  async putBytes(
    relativePath: string,
    bytes: Uint8Array,
    modifiedAt = new Date().toISOString(),
    metadata: { mimeType?: string; originalName?: string } = {},
  ): Promise<FileRecord> {
    const normalized = normalizeVaultPath(relativePath);
    this.assertWritable(normalized);
    const record: FileRecord = {
      path: normalized,
      data: Buffer.from(bytes).toString("base64"),
      sizeBytes: bytes.byteLength,
      sha256: digest(bytes),
      modifiedAt,
      ...(metadata.mimeType ? { mimeType: normalizeMimeType(metadata.mimeType) } : {}),
      ...(metadata.originalName ? { originalName: path.posix.basename(metadata.originalName.trim()) } : {}),
    };
    await this.store.setJSON(fileKey(normalized), record);
    return record;
  }

  async putText(relativePath: string, content: string): Promise<FileRecord> {
    return this.putBytes(relativePath, Buffer.from(content, "utf8"));
  }

  async getRecord(relativePath: string): Promise<FileRecord> {
    const normalized = normalizeVaultPath(relativePath);
    const record = await this.store.get(fileKey(normalized), { type: "json" }) as FileRecord | null;
    if (!record) throw new VaultProblem("NOT_FOUND", `File not found: ${normalized}`, "List the parent folder and check the exact path.");
    return record;
  }

  async getFileBytes(relativePath: string): Promise<{ record: FileRecord; bytes: Uint8Array }> {
    const record = await this.getRecord(relativePath);
    return { record, bytes: decodeData(record) };
  }

  async allRecords(): Promise<FileRecord[]> {
    const result = await this.store.list({ prefix: FILE_PREFIX }) as { blobs: Array<{ key: string }> };
    const records: FileRecord[] = [];
    for (const blob of result.blobs) {
      const record = await this.store.get(blob.key, { type: "json" }) as FileRecord | null;
      if (record) records.push(record);
    }
    return records.sort((a, b) => a.path.localeCompare(b.path));
  }

  async info(): Promise<Record<string, unknown>> {
    const files = await this.allRecords();
    const folders = new Set<string>();
    for (const file of files) {
      const segments = file.path.split("/");
      for (let index = 1; index < segments.length; index += 1) folders.add(segments.slice(0, index).join("/"));
    }
    return {
      vaultName: "DESK-OS Obsidian Cloud Vault",
      storage: "Vercel Postgres",
      noteCount: files.filter((file) => file.path.toLowerCase().endsWith(".md")).length,
      fileCount: files.length,
      folderCount: folders.size,
      totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      updatedAt: files.map((file) => file.modifiedAt).sort().at(-1) ?? null,
    };
  }

  async list(input: { folder?: string; recursive?: boolean; kind?: "all" | "file" | "folder" | "note"; cursor?: number; limit?: number }): Promise<Record<string, unknown>> {
    const folder = input.folder ? normalizeVaultPath(input.folder) : "";
    const files = await this.allRecords();
    const folderSet = new Set<string>();
    const fileEntries: Array<Record<string, unknown>> = [];
    for (const file of files) {
      if (folder && file.path !== folder && !file.path.startsWith(`${folder}/`)) continue;
      const relative = folder ? file.path.slice(folder.length + 1) : file.path;
      if (!(input.recursive ?? false) && relative.includes("/")) {
        folderSet.add(folder ? `${folder}/${relative.split("/")[0]}` : relative.split("/")[0] ?? "");
        continue;
      }
      const segments = relative.split("/");
      for (let index = 1; index < segments.length; index += 1) {
        folderSet.add(folder ? `${folder}/${segments.slice(0, index).join("/")}` : segments.slice(0, index).join("/"));
      }
      fileEntries.push({ path: file.path, name: path.posix.basename(file.path), kind: "file", sizeBytes: file.sizeBytes, modifiedAt: file.modifiedAt, sha256: file.sha256, mimeType: file.mimeType ?? null });
    }
    const folderEntries = [...folderSet].filter(Boolean).map((value) => ({ path: value, name: path.posix.basename(value), kind: "folder", sizeBytes: null, modifiedAt: null }));
    const kind = input.kind ?? "all";
    const all = [...folderEntries, ...fileEntries].filter((entry) => {
      if (kind === "file") return entry.kind === "file";
      if (kind === "folder") return entry.kind === "folder";
      if (kind === "note") return entry.kind === "file" && String(entry.path).toLowerCase().endsWith(".md");
      return true;
    }).sort((a, b) => String(a.path).localeCompare(String(b.path)));
    const cursor = Math.max(0, input.cursor ?? 0);
    const limit = Math.min(200, Math.max(1, input.limit ?? 50));
    return { entries: all.slice(cursor, cursor + limit), nextCursor: cursor + limit < all.length ? cursor + limit : null, total: all.length };
  }

  async read(relativePath: string): Promise<Record<string, unknown>> {
    const record = await this.getRecord(relativePath);
    if (record.sizeBytes > MAX_READ_BYTES) {
      throw new VaultProblem("TOO_LARGE", `File exceeds the ${MAX_READ_BYTES}-byte read limit.`, "Export the file or raise the server limit in a controlled revision.");
    }
    const content = textContent(record);
    return {
      path: record.path,
      content,
      sizeBytes: record.sizeBytes,
      modifiedAt: record.modifiedAt,
      sha256: record.sha256,
      ...(record.path.toLowerCase().endsWith(".md") ? { frontmatter: parseNote(content).frontmatter } : {}),
    };
  }

  async importBinary(input: {
    path: string;
    dataBase64: string;
    mimeType?: string;
    originalName?: string;
    overwrite?: boolean;
    expectedSha256?: string;
    expectedContentSha256?: string;
  }): Promise<Record<string, unknown>> {
    const normalized = normalizeVaultPath(input.path);
    const decoded = decodeBase64Payload(input.dataBase64);
    const contentSha256 = digest(decoded.bytes);
    if (input.expectedContentSha256 && input.expectedContentSha256 !== contentSha256) {
      throw new VaultProblem("CHECKSUM_MISMATCH", "The uploaded bytes do not match expectedContentSha256.", "Re-read the original file and retry without changing its bytes.");
    }

    let previous: FileRecord | null = null;
    try { previous = await this.getRecord(normalized); }
    catch (error) {
      if (!(error instanceof VaultProblem) || error.code !== "NOT_FOUND") throw error;
    }

    if (previous && !(input.overwrite ?? false)) {
      throw new VaultProblem("ALREADY_EXISTS", `File already exists: ${normalized}`, "Choose a different path or set overwrite=true with expectedSha256 from a current listing.");
    }
    if (previous && input.expectedSha256 !== previous.sha256) {
      throw new VaultProblem("CONFLICT", "The existing file revision was not confirmed.", "List the file, copy its current sha256 into expectedSha256, and retry.");
    }
    if (previous) await this.trash(normalized);

    const mimeType = normalizeMimeType(input.mimeType) ?? decoded.inferredMimeType ?? "application/octet-stream";
    const record = await this.putBytes(normalized, decoded.bytes, new Date().toISOString(), {
      mimeType,
      originalName: input.originalName ?? path.posix.basename(normalized),
    });
    return {
      path: record.path,
      imported: true,
      replaced: Boolean(previous),
      previousRecoverable: Boolean(previous),
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      mimeType: record.mimeType,
      originalName: record.originalName,
      encoding: "base64",
    };
  }

  async createNote(input: { path: string; content: string; frontmatter?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const normalized = normalizeVaultPath(input.path);
    if (!normalized.toLowerCase().endsWith(".md")) throw new VaultProblem("INVALID_INPUT", "Note paths must end in .md.", "Use a Markdown path such as Projects/Plan.md.");
    try {
      await this.getRecord(normalized);
      throw new VaultProblem("ALREADY_EXISTS", `Note already exists: ${normalized}`, "Use the update tool with a revision hash.");
    } catch (error) {
      if (!(error instanceof VaultProblem) || error.code !== "NOT_FOUND") throw error;
    }
    const record = await this.putText(normalized, serializeNote(input.frontmatter ?? {}, input.content));
    return { path: record.path, created: true, sizeBytes: record.sizeBytes, sha256: record.sha256 };
  }

  async updateNote(input: { path: string; content: string; mode?: "replace" | "append" | "prepend"; expectedSha256?: string }): Promise<Record<string, unknown>> {
    const current = await this.getRecord(input.path);
    if (!current.path.toLowerCase().endsWith(".md")) throw new VaultProblem("INVALID_INPUT", "Only Markdown notes can use this update tool.", "Use a .md note path.");
    if (input.expectedSha256 && input.expectedSha256 !== current.sha256) {
      throw new VaultProblem("CONFLICT", "The note changed since it was read.", "Read it again, merge the changes, and retry using the new sha256.");
    }
    const prior = textContent(current);
    const mode = input.mode ?? "replace";
    const next = mode === "append" ? prior + input.content : mode === "prepend" ? input.content + prior : input.content;
    const record = await this.putText(current.path, next);
    return { path: record.path, updated: true, mode, sizeBytes: record.sizeBytes, sha256: record.sha256 };
  }

  async updateTextFile(input: { path: string; content: string; expectedSha256?: string }): Promise<Record<string, unknown>> {
    const current = await this.getRecord(input.path);
    textContent(current);
    if (input.expectedSha256 && input.expectedSha256 !== current.sha256) {
      throw new VaultProblem("CONFLICT", "The file changed since it was read.", "Reload it, merge the changes, and retry using the new sha256.");
    }
    const record = await this.putText(current.path, input.content);
    return { path: record.path, updated: true, mode: "replace", sizeBytes: record.sizeBytes, sha256: record.sha256 };
  }

  async updateFrontmatter(input: { path: string; set?: Record<string, unknown>; remove?: string[]; expectedSha256?: string }): Promise<Record<string, unknown>> {
    const current = await this.getRecord(input.path);
    if (input.expectedSha256 && input.expectedSha256 !== current.sha256) {
      throw new VaultProblem("CONFLICT", "The note changed since it was read.", "Read it again and retry using the new sha256.");
    }
    const parsed = parseNote(textContent(current));
    const properties = { ...parsed.frontmatter, ...(input.set ?? {}) };
    for (const key of input.remove ?? []) delete properties[key];
    const record = await this.putText(current.path, serializeNote(properties, parsed.body));
    return { path: record.path, frontmatter: properties, sha256: record.sha256 };
  }

  async search(input: { query: string; folder?: string; caseSensitive?: boolean; regex?: boolean; limit?: number }): Promise<Record<string, unknown>> {
    if (!input.query) throw new VaultProblem("INVALID_INPUT", "Search query cannot be empty.", "Provide literal text or a regular expression.");
    if (input.regex) assertSafeRegexPattern(input.query);
    let matcher: RegExp;
    try {
      const source = input.regex ? input.query : input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      matcher = new RegExp(source, input.caseSensitive ? "g" : "gi");
    } catch {
      throw new VaultProblem("INVALID_REGEX", "The regular expression is invalid.", "Correct it or set regex=false.");
    }
    const folder = input.folder ? normalizeVaultPath(input.folder) : "";
    const notes = (await this.allRecords()).filter((file) => file.path.toLowerCase().endsWith(".md") && (!folder || file.path.startsWith(`${folder}/`))).slice(0, MAX_SEARCH_FILES);
    const matches: Array<{ path: string; line: number; snippet: string }> = [];
    const limit = Math.min(input.limit ?? 25, MAX_SEARCH_RESULTS);
    // Regex mode only: bound the input fed to the engine per line and cap
    // total wall-clock time across files, so a slow-but-not-rejected
    // pattern can't hang the invocation on a large vault (baseline §11.1).
    const deadline = input.regex ? Date.now() + MAX_SEARCH_MILLIS : Number.POSITIVE_INFINITY;
    let timedOut = false;
    for (const note of notes) {
      if (input.regex && Date.now() > deadline) {
        timedOut = true;
        break;
      }
      const lines = textContent(note).split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const candidate = input.regex ? line.slice(0, MAX_REGEX_LINE_CHARS) : line;
        matcher.lastIndex = 0;
        if (matcher.test(candidate)) matches.push({ path: note.path, line: index + 1, snippet: line.slice(0, 500) });
        if (matches.length >= limit) break;
      }
      if (matches.length >= limit) break;
    }
    return { matches, filesScanned: notes.length, truncated: matches.length >= limit || timedOut };
  }

  async move(input: { source: string; destination: string; overwrite?: boolean }): Promise<Record<string, unknown>> {
    const source = normalizeVaultPath(input.source);
    const destination = normalizeVaultPath(input.destination);
    if (source === destination) throw new VaultProblem("INVALID_INPUT", "Source and destination are identical.", "Choose a different destination.");
    // Deletes the source directly (not via putBytes/trash), so it needs its own guard.
    this.assertWritable(source);
    const current = await this.getRecord(source);
    if (!(input.overwrite ?? false)) await this.assertMissing(destination);
    else await this.trashIfPresent(destination);
    await this.putBytes(destination, decodeData(current), new Date().toISOString(), { mimeType: current.mimeType, originalName: current.originalName });
    await this.store.delete(fileKey(source));
    return { source, destination, moved: true };
  }

  async copy(input: { source: string; destination: string; overwrite?: boolean }): Promise<Record<string, unknown>> {
    const source = normalizeVaultPath(input.source);
    const destination = normalizeVaultPath(input.destination);
    if (source === destination) throw new VaultProblem("INVALID_INPUT", "Source and destination are identical.", "Choose a different destination.");
    const current = await this.getRecord(source);
    if (!(input.overwrite ?? false)) await this.assertMissing(destination);
    else await this.trashIfPresent(destination);
    await this.putBytes(destination, decodeData(current), new Date().toISOString(), { mimeType: current.mimeType, originalName: current.originalName });
    return { source, destination, copied: true };
  }

  async trash(relativePath: string): Promise<Record<string, unknown>> {
    const current = await this.getRecord(relativePath);
    this.assertWritable(current.path);
    const trashId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const record: TrashRecord = { trashId, originalPath: current.path, trashedAt: new Date().toISOString(), file: current };
    await this.store.setJSON(trashKey(trashId), record);
    await this.store.delete(fileKey(current.path));
    return { path: current.path, trashed: true, recoverable: true, trashId };
  }

  async listTrash(): Promise<Record<string, unknown>> {
    const result = await this.store.list({ prefix: TRASH_PREFIX }) as { blobs: Array<{ key: string }> };
    const items: Array<Record<string, unknown>> = [];
    for (const blob of result.blobs) {
      const record = await this.store.get(blob.key, { type: "json" }) as TrashRecord | null;
      if (record) items.push({ trashId: record.trashId, originalPath: record.originalPath, trashedAt: record.trashedAt, sizeBytes: record.file.sizeBytes });
    }
    return { items: items.sort((a, b) => String(b.trashedAt).localeCompare(String(a.trashedAt))) };
  }

  async restoreTrash(input: { trashId: string; destination?: string; overwrite?: boolean }): Promise<Record<string, unknown>> {
    if (!/^[A-Za-z0-9-]+$/.test(input.trashId)) throw new VaultProblem("INVALID_INPUT", "Invalid trash identifier.", "Use an identifier returned by list trash.");
    const record = await this.store.get(trashKey(input.trashId), { type: "json" }) as TrashRecord | null;
    if (!record) throw new VaultProblem("NOT_FOUND", "Trash record not found.", "List recoverable trash and use an exact identifier.");
    const destination = normalizeVaultPath(input.destination ?? record.originalPath);
    if (!(input.overwrite ?? false)) await this.assertMissing(destination);
    else await this.trashIfPresent(destination);
    await this.putBytes(destination, decodeData(record.file), new Date().toISOString(), { mimeType: record.file.mimeType, originalName: record.file.originalName });
    await this.store.delete(trashKey(input.trashId));
    return { trashId: input.trashId, destination, restored: true };
  }

  async deleteAllActiveFiles(): Promise<number> {
    const result = await this.store.list({ prefix: FILE_PREFIX }) as { blobs: Array<{ key: string }> };
    for (const blob of result.blobs) await this.store.delete(blob.key);
    return result.blobs.length;
  }

  private async assertMissing(relativePath: string): Promise<void> {
    try {
      await this.getRecord(relativePath);
      throw new VaultProblem("ALREADY_EXISTS", `Destination already exists: ${relativePath}`, "Choose another destination or set overwrite=true intentionally.");
    } catch (error) {
      if (error instanceof VaultProblem && error.code === "NOT_FOUND") return;
      throw error;
    }
  }

  private async trashIfPresent(relativePath: string): Promise<void> {
    try {
      await this.trash(relativePath);
    } catch (error) {
      if (error instanceof VaultProblem && error.code === "NOT_FOUND") return;
      throw error;
    }
  }
}
