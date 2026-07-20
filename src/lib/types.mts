export interface FileRecord {
  path: string;
  /** File contents, base64-encoded. */
  data: string;
  sizeBytes: number;
  sha256: string;
  /** ISO-8601 timestamp of the last write. */
  modifiedAt: string;
  mimeType?: string;
  originalName?: string;
}

export interface TrashRecord {
  trashId: string;
  originalPath: string;
  trashedAt: string;
  file: FileRecord;
}
