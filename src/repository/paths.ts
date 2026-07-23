import crypto from "node:crypto";

/**
 * All DESK-OS operational state lives under a single non-hidden vault prefix
 * (baseline §4: `_desk-os/` instead of `.desk-os/` so the existing
 * hidden-path protection in normalizeVaultPath stays untouched).
 */
export const DESK_OS_ROOT = "_desk-os";

export const RECORD_TYPES = ["project", "sprint", "task", "evidence", "proposal"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

const STATE_FOLDERS: Record<RecordType, string> = {
  project: "projects",
  sprint: "sprints",
  task: "tasks",
  evidence: "evidence",
  proposal: "proposals",
};

export function statePath(type: RecordType, id: string): string {
  return `${DESK_OS_ROOT}/state/${STATE_FOLDERS[type]}/${id}.json`;
}

export function stateFolder(type: RecordType): string {
  return `${DESK_OS_ROOT}/state/${STATE_FOLDERS[type]}`;
}

export function indexPath(type: RecordType): string {
  return `${DESK_OS_ROOT}/index/${STATE_FOLDERS[type]}.json`;
}

export function auditPath(at: string, auditId: string): string {
  return `${DESK_OS_ROOT}/audit/${at.replaceAll(":", "-")}_${auditId}.json`;
}

export function auditIndexPath(): string {
  return `${DESK_OS_ROOT}/index/audit.json`;
}

export function idempotencyPath(key: string): string {
  const digest = crypto.createHash("sha256").update(key, "utf8").digest("hex");
  return `${DESK_OS_ROOT}/idempotency/${digest}.json`;
}

export function backupFolder(stamp: string, label: string): string {
  const safeLabel = label.replaceAll(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "backup";
  return `${DESK_OS_ROOT}/backups/${stamp.replaceAll(":", "-")}_${safeLabel}`;
}

export function isDeskOsPath(vaultPath: string): boolean {
  return vaultPath === DESK_OS_ROOT || vaultPath.startsWith(`${DESK_OS_ROOT}/`);
}
