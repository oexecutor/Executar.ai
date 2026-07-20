import type { BlobStore } from "../../src/lib/stores.mjs";

export class MemoryBlobStore implements BlobStore {
  private readonly entries = new Map<string, string>();

  async getJSON(key: string): Promise<unknown | null> {
    const value = this.entries.get(key);
    return value === undefined ? null : JSON.parse(value);
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    this.entries.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const keys = [...this.entries.keys()];
    return prefix ? keys.filter((key) => key.startsWith(prefix)) : keys;
  }

  size(): number {
    return this.entries.size;
  }
}
