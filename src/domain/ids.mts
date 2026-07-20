import crypto from "node:crypto";

export const ID_PREFIXES = {
  workspace: "wsp",
  project: "prj",
  sprint: "spr",
  task: "tsk",
  step: "stp",
  deliverable: "del",
  evidence: "evd",
  decision: "dec",
  proposal: "prop",
  audit: "aud",
} as const;

export type EntityKind = keyof typeof ID_PREFIXES;

const RANDOM_PATTERN = /^[a-z0-9_]+_[0-9a-f]{16}$/;

export function newId(kind: EntityKind): string {
  return `${ID_PREFIXES[kind]}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Accepts both generated IDs (prj_ + 16 hex) and hand-authored contract IDs
 * (e.g. `prj_desk_os_mcp` from contracts/example-project.json): prefix plus
 * at least one [a-z0-9_-] character.
 */
export function isEntityId(value: unknown, kind?: EntityKind): boolean {
  if (typeof value !== "string") return false;
  const prefixes = kind ? [ID_PREFIXES[kind]] : Object.values(ID_PREFIXES);
  return prefixes.some((prefix) => new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`).test(value));
}

export function assertEntityId(value: unknown, kind: EntityKind): string {
  if (!isEntityId(value, kind)) {
    throw new Error(`Expected a ${String(kind)} id (${ID_PREFIXES[kind]}_...), got: ${String(value)}`);
  }
  return value as string;
}

export { RANDOM_PATTERN as GENERATED_ID_PATTERN };
