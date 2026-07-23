import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Structural subset of Netlify Blobs' Store that the rest of this codebase
 * actually calls (see BlobVaultService, vault-adapter.mts, oauth-*.mts) —
 * kept as our own type so nothing here depends on @netlify/blobs anymore.
 */
export interface KvStore {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>;
}

const CONNECTION_STRING_VARS = ["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

function connectionString(): string {
  for (const name of CONNECTION_STRING_VARS) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`No Postgres connection string found in any of: ${CONNECTION_STRING_VARS.join(", ")}`);
}

let schemaReady: Promise<void> | undefined;
let oauthSchemaReady: Promise<void> | undefined;

/** One namespace == one logical "bucket" (mirrors a Netlify Blobs store name). */
export class PostgresKvStore implements KvStore {
  private readonly sql: NeonQueryFunction<false, false>;

  constructor(private readonly namespace: string) {
    this.sql = neon(connectionString(), { arrayMode: false, fullResults: false });
  }

  private async ensureSchema(): Promise<void> {
    schemaReady ??= this.sql`
      CREATE TABLE IF NOT EXISTS kv_store (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (namespace, key)
      )
    `.then(() => undefined);
    await schemaReady;
  }

  async get(key: string): Promise<unknown> {
    await this.ensureSchema();
    const rows = await this.sql`SELECT value FROM kv_store WHERE namespace = ${this.namespace} AND key = ${key}`;
    return rows.length > 0 ? (rows[0] as { value: unknown }).value : null;
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.ensureSchema();
    const json = JSON.stringify(value);
    await this.sql`
      INSERT INTO kv_store (namespace, key, value, updated_at)
      VALUES (${this.namespace}, ${key}, ${json}::jsonb, now())
      ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }

  async delete(key: string): Promise<void> {
    await this.ensureSchema();
    await this.sql`DELETE FROM kv_store WHERE namespace = ${this.namespace} AND key = ${key}`;
  }

  async list({ prefix }: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }> {
    await this.ensureSchema();
    const rows = await this.sql`SELECT key FROM kv_store WHERE namespace = ${this.namespace} AND key LIKE ${`${prefix}%`}`;
    return { blobs: (rows as Array<{ key: string }>).map((row) => ({ key: row.key })) };
  }
}

/**
 * OAuth clients and grants are server-owned and not workspace content.
 * Keeping them in a dedicated table avoids colliding with the Phase 4
 * workspace-scoped `public.kv_store` schema.
 */
export class OAuthPostgresStore implements KvStore {
  private readonly sql: NeonQueryFunction<false, false>;

  constructor(private readonly namespace: string) {
    this.sql = neon(connectionString(), { arrayMode: false, fullResults: false });
  }

  private async ensureSchema(): Promise<void> {
    oauthSchemaReady ??= this.sql`
      CREATE TABLE IF NOT EXISTS oauth_kv_store (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (namespace, key)
      )
    `.then(() => undefined);
    await oauthSchemaReady;
  }

  async get(key: string): Promise<unknown> {
    await this.ensureSchema();
    const rows = await this.sql`SELECT value FROM oauth_kv_store WHERE namespace = ${this.namespace} AND key = ${key}`;
    return rows.length > 0 ? (rows[0] as { value: unknown }).value : null;
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.ensureSchema();
    const json = JSON.stringify(value);
    await this.sql`
      INSERT INTO oauth_kv_store (namespace, key, value, updated_at)
      VALUES (${this.namespace}, ${key}, ${json}::jsonb, now())
      ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }

  async delete(key: string): Promise<void> {
    await this.ensureSchema();
    await this.sql`DELETE FROM oauth_kv_store WHERE namespace = ${this.namespace} AND key = ${key}`;
  }

  async list({ prefix }: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }> {
    await this.ensureSchema();
    const rows = await this.sql`SELECT key FROM oauth_kv_store WHERE namespace = ${this.namespace} AND key LIKE ${`${prefix}%`}`;
    return { blobs: (rows as Array<{ key: string }>).map((row) => ({ key: row.key })) };
  }
}
