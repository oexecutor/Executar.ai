import { createHash, randomUUID } from "node:crypto";
import type { BlobStore } from "./stores.mjs";
import type { FileRecord, TrashRecord } from "./types.mjs";
import { VaultProblem } from "./http.mjs";

const MAX_PATH_LENGTH = 512;
const MAX_SEARCH_MILLIS = 2000;
const MAX_REGEX_PATTERN_LENGTH = 128;
const MAX_SEARCH_FILES = 2000;

/** Path segments that may never be read or written through the vault. */
const ALWAYS_PROTECTED = new Set([".obsidian", ".git", ".netlify", ".env"]);

const FILE_PREFIX = "file/";
const TRASH_PREFIX = "trash/";

export function sha256hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validates and normalizes a vault-relative path.
 *
 * Rejects traversal (`..`), absolute paths, backslashes, control characters,
 * empty segments and any dot-prefixed (hidden) segment. The DESK-OS
 * operational state deliberately lives under the non-hidden `_desk-os/`
 * prefix so this protection stays intact (baseline §4).
 */
export function normalizeVaultPath(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new VaultProblem("invalid_path", "Path must not be empty.");
  }
  if (raw.length > MAX_PATH_LENGTH) {
    throw new VaultProblem("invalid_path", `Path exceeds ${MAX_PATH_LENGTH} characters.`);
  }
  if (raw.includes("\\")) {
    throw new VaultProblem("invalid_path", "Backslashes are not allowed in vault paths.", "Use forward slashes.");
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) {
    throw new VaultProblem("invalid_path", "Control characters are not allowed in vault paths.");
  }
  if (raw.startsWith("/")) {
    throw new VaultProblem("invalid_path", "Absolute paths are not allowed.", "Use a vault-relative path.");
  }
  const segments = raw.replace(/\/+$/, "").split("/");
  for (const segment of segments) {
    if (segment === "" ) {
      throw new VaultProblem("invalid_path", "Empty path segments are not allowed.");
    }
    if (segment === "." || segment === "..") {
      throw new VaultProblem("invalid_path", "Path traversal segments are not allowed.");
    }
    if (segment.startsWith(".") || ALWAYS_PROTECTED.has(segment.toLowerCase())) {
      throw new VaultProblem(
        "protected_path",
        `Segment "${segment}" is protected and cannot be accessed through the vault.`,
        undefined,
        403,
      );
    }
  }
  return segments.join("/");
}

export interface PutOptions {
  /** SHA-256 the caller last saw; mismatch raises a 409 conflict. */
  expectedSha256?: string;
  mimeType?: string;
  originalName?: string;
  /** Move the existing record to trash before overwriting. */
  overwriteToTrash?: boolean;
}

export interface SearchOptions {
  regex?: boolean;
  limit?: number;
}

export interface SearchMatch {
  path: string;
  line: number;
  text: string;
}

const TEXT_EXTENSIONS = new Set(["md", "txt", "json", "yaml", "yml", "csv", "html", "css", "js", "ts"]);

function isTextPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

export class BlobVaultService {
  constructor(private readonly store: BlobStore) {}

  private fileKey(path: string): string {
    return FILE_PREFIX + encodeURIComponent(path);
  }

  async getRecord(inputPath: string): Promise<FileRecord | null> {
    const path = normalizeVaultPath(inputPath);
    const record = (await this.store.getJSON(this.fileKey(path))) as FileRecord | null;
    return record;
  }

  async requireRecord(inputPath: string): Promise<FileRecord> {
    const record = await this.getRecord(inputPath);
    if (!record) {
      throw new VaultProblem("not_found", `No file at "${inputPath}".`, "Check the path with list.", 404);
    }
    return record;
  }

  async putBytes(inputPath: string, bytes: Uint8Array, options: PutOptions = {}): Promise<FileRecord> {
    const path = normalizeVaultPath(inputPath);
    const existing = (await this.store.getJSON(this.fileKey(path))) as FileRecord | null;
    if (existing && options.expectedSha256 !== undefined && existing.sha256 !== options.expectedSha256) {
      throw new VaultProblem(
        "conflict",
        `File "${path}" changed since it was last read.`,
        "Re-read the file and retry with the current sha256.",
        409,
      );
    }
    if (existing && options.overwriteToTrash) {
      await this.moveRecordToTrash(existing);
    }
    const record: FileRecord = {
      path,
      data: Buffer.from(bytes).toString("base64"),
      sizeBytes: bytes.byteLength,
      sha256: sha256hex(bytes),
      modifiedAt: new Date().toISOString(),
      ...(options.mimeType ? { mimeType: options.mimeType } : {}),
      ...(options.originalName ? { originalName: options.originalName } : {}),
    };
    await this.store.setJSON(this.fileKey(path), record);
    return record;
  }

  async putText(inputPath: string, text: string, options: PutOptions = {}): Promise<FileRecord> {
    return this.putBytes(inputPath, new TextEncoder().encode(text), options);
  }

  async readText(inputPath: string): Promise<string> {
    const record = await this.requireRecord(inputPath);
    return Buffer.from(record.data, "base64").toString("utf-8");
  }

  async listPaths(prefix?: string): Promise<string[]> {
    const normalizedPrefix = prefix ? normalizeVaultPath(prefix) : undefined;
    const keys = await this.store.listKeys(FILE_PREFIX);
    const paths = keys
      .filter((key) => key.startsWith(FILE_PREFIX))
      .map((key) => decodeURIComponent(key.slice(FILE_PREFIX.length)));
    const filtered = normalizedPrefix
      ? paths.filter((path) => path === normalizedPrefix || path.startsWith(normalizedPrefix + "/"))
      : paths;
    return filtered.sort();
  }

  /**
   * Sequential per-file reads — acceptable for small explicit calls only.
   * Higher layers must use their own index manifests (baseline §4/§11.2)
   * instead of calling this in hot paths.
   */
  async allRecords(prefix?: string): Promise<FileRecord[]> {
    const paths = await this.listPaths(prefix);
    const records: FileRecord[] = [];
    for (const path of paths) {
      const record = (await this.store.getJSON(this.fileKey(path))) as FileRecord | null;
      if (record) records.push(record);
    }
    return records;
  }

  /**
   * Text search with a hard time budget so user-supplied patterns cannot
   * hang an invocation (baseline §11.1). Plain substring match by default;
   * regex mode caps pattern length and still honors the time budget.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchMatch[]> {
    if (!query.trim()) {
      throw new VaultProblem("invalid_query", "Search query must not be empty.");
    }
    let matcher: (line: string) => boolean;
    if (options.regex) {
      if (query.length > MAX_REGEX_PATTERN_LENGTH) {
        throw new VaultProblem(
          "invalid_query",
          `Regex patterns are limited to ${MAX_REGEX_PATTERN_LENGTH} characters.`,
        );
      }
      let pattern: RegExp;
      try {
        pattern = new RegExp(query, "i");
      } catch {
        throw new VaultProblem("invalid_query", "Invalid regular expression.");
      }
      matcher = (line) => pattern.test(line);
    } else {
      const needle = query.toLowerCase();
      matcher = (line) => line.toLowerCase().includes(needle);
    }

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const deadline = Date.now() + MAX_SEARCH_MILLIS;
    const matches: SearchMatch[] = [];
    const paths = (await this.listPaths()).filter(isTextPath).slice(0, MAX_SEARCH_FILES);

    for (const path of paths) {
      if (Date.now() > deadline) {
        throw new VaultProblem(
          "search_timeout",
          "Search exceeded its time budget.",
          "Narrow the query or search a smaller vault prefix.",
          408,
        );
      }
      const record = (await this.store.getJSON(this.fileKey(path))) as FileRecord | null;
      if (!record) continue;
      const lines = Buffer.from(record.data, "base64").toString("utf-8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (matcher(lines[i])) {
          matches.push({ path, line: i + 1, text: lines[i].slice(0, 300) });
          if (matches.length >= limit) return matches;
        }
      }
    }
    return matches;
  }

  private async moveRecordToTrash(record: FileRecord): Promise<TrashRecord> {
    const trashRecord: TrashRecord = {
      trashId: randomUUID(),
      originalPath: record.path,
      trashedAt: new Date().toISOString(),
      file: record,
    };
    await this.store.setJSON(TRASH_PREFIX + trashRecord.trashId, trashRecord);
    return trashRecord;
  }

  async trash(inputPath: string): Promise<TrashRecord> {
    const record = await this.requireRecord(inputPath);
    const trashRecord = await this.moveRecordToTrash(record);
    await this.store.delete(this.fileKey(record.path));
    return trashRecord;
  }

  async listTrash(): Promise<TrashRecord[]> {
    const keys = await this.store.listKeys(TRASH_PREFIX);
    const records: TrashRecord[] = [];
    for (const key of keys) {
      const record = (await this.store.getJSON(key)) as TrashRecord | null;
      if (record) records.push(record);
    }
    return records.sort((a, b) => a.trashedAt.localeCompare(b.trashedAt));
  }

  async restoreTrash(trashId: string): Promise<FileRecord> {
    const trashRecord = (await this.store.getJSON(TRASH_PREFIX + trashId)) as TrashRecord | null;
    if (!trashRecord) {
      throw new VaultProblem("not_found", `No trash entry "${trashId}".`, undefined, 404);
    }
    const existing = (await this.store.getJSON(this.fileKey(trashRecord.originalPath))) as FileRecord | null;
    if (existing) {
      await this.moveRecordToTrash(existing);
    }
    await this.store.setJSON(this.fileKey(trashRecord.originalPath), trashRecord.file);
    await this.store.delete(TRASH_PREFIX + trashId);
    return trashRecord.file;
  }
}
