import { getStore } from "@netlify/blobs";
import { deployContext } from "./env.mjs";

/**
 * Minimal blob-store contract used by the vault and repository layers.
 * Production uses Netlify Blobs; tests inject an in-memory implementation.
 */
export interface BlobStore {
  getJSON(key: string): Promise<unknown | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix?: string): Promise<string[]>;
}

class NetlifyBlobStore implements BlobStore {
  constructor(private readonly name: string) {}

  private store() {
    return getStore({ name: this.name, consistency: "strong" });
  }

  async getJSON(key: string): Promise<unknown | null> {
    const value = await this.store().get(key, { type: "json" });
    return value ?? null;
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.store().setJSON(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.store().delete(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const result = await this.store().list(prefix ? { prefix } : {});
    return result.blobs.map((blob) => blob.key);
  }
}

/**
 * Store names are kept identical to the pre-reconstruction deployment
 * ("obsidian-vault-*"/"obsidian-oauth-*") so existing production data in
 * Netlify Blobs remains reachable. Do not rename.
 */
export function vaultStore(): BlobStore {
  const suffix = deployContext() === "production" ? "production" : "preview";
  return new NetlifyBlobStore(`obsidian-vault-${suffix}`);
}

export function oauthStore(): BlobStore {
  const suffix = deployContext() === "production" ? "production" : "preview";
  return new NetlifyBlobStore(`obsidian-oauth-${suffix}`);
}
