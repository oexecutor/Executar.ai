import { describe, expect, it } from "vitest";
import { BlobVaultService } from "../src/lib/vault.js";
import { memoryStore } from "./helpers/memory-store.js";

/**
 * baseline §11.1: obsidian_search_notes ran a user-supplied regex against
 * up to 2,000 note bodies with no time budget or pattern check — a
 * pathological pattern (classic catastrophic backtracking) could hang a
 * function invocation. These tests prove: (a) the textbook exploit shapes
 * are rejected outright before any matching happens, (b) a pattern that
 * IS allowed still returns fast even against an adversarial line, and
 * (c) ordinary regex/literal search still works.
 */

async function vaultWithNote(content: string) {
  const vault = new BlobVaultService(memoryStore());
  await vault.createNote({ path: "notes/target.md", content });
  return vault;
}

describe("search() rejects catastrophic-backtracking regex patterns", () => {
  const classics = ["(a+)+$", "(a*)*b", "([a-zA-Z]+)*$", "(a|a)+b"];

  it.each(classics)("rejects %s before matching anything", async (pattern) => {
    const vault = await vaultWithNote("just some ordinary note text");
    await expect(vault.search({ query: pattern, regex: true })).rejects.toMatchObject({ code: "UNSAFE_REGEX" });
  });

  it("rejects oversized regex patterns", async () => {
    const vault = await vaultWithNote("text");
    await expect(vault.search({ query: "a".repeat(500), regex: true })).rejects.toMatchObject({
      code: "INVALID_REGEX",
    });
  });

  it("does not apply the regex-only length/pattern limits to literal search", async () => {
    const vault = await vaultWithNote("(a+)+ literally appears in this note, not as a pattern");
    const result = (await vault.search({ query: "(a+)+", regex: false })) as { matches: unknown[] };
    expect(result.matches).toHaveLength(1);
  });
});

describe("search() stays fast against an adversarial line even for an allowed pattern", () => {
  it("returns well within the function's time budget for a long non-matching line", async () => {
    // Not a classic nested-quantifier shape (passes the static check), but
    // an adversarial 50k-char non-matching line would still be expensive
    // for a naive engine without the per-line length cap.
    const adversarial = "a".repeat(50_000) + "!";
    const vault = await vaultWithNote(adversarial);
    const started = Date.now();
    const result = (await vault.search({ query: "^a+b$", regex: true })) as { matches: unknown[]; truncated: boolean };
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(result.matches).toHaveLength(0);
  });
});

describe("search() still finds real matches", () => {
  it("literal search is case-insensitive by default", async () => {
    const vault = await vaultWithNote("Alpha\nBeta target line\nGamma");
    const result = (await vault.search({ query: "TARGET" })) as { matches: Array<{ line: number }> };
    expect(result.matches).toEqual([{ line: 2, path: "notes/target.md", snippet: "Beta target line" }]);
  });

  it("safe regex patterns still match", async () => {
    const vault = await vaultWithNote("id: ABC-123\nid: XYZ-999");
    const result = (await vault.search({ query: "[A-Z]{3}-\\d{3}", regex: true })) as { matches: unknown[] };
    expect(result.matches).toHaveLength(2);
  });
});
