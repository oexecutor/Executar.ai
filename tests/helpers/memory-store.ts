import type { Store } from "@netlify/blobs";

/** Same in-memory Store fake used by tests/vault.test.ts, shared. */
export function memoryStore(): Store {
  const values = new Map<string, unknown>();
  return {
    async set(key: string, value: unknown) {
      values.set(key, value);
    },
    async setJSON(key: string, value: unknown) {
      values.set(key, structuredClone(value));
    },
    async get(key: string) {
      return values.has(key) ? structuredClone(values.get(key)) : null;
    },
    async getWithMetadata() {
      return null;
    },
    async getMetadata() {
      return null;
    },
    async list(options?: { prefix?: string }) {
      return {
        blobs: [...values.keys()]
          .filter((key) => !options?.prefix || key.startsWith(options.prefix))
          .map((key) => ({ key, etag: "test" })),
        directories: [],
      };
    },
    async delete(key: string) {
      values.delete(key);
    },
  } as unknown as Store;
}
