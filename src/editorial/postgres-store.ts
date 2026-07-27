import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { postgresConnectionString } from "../lib/kv-store.js";
import type { EditorialRepository } from "./store.js";
import type { EditorialEvent, EditorialPublication } from "./types.js";

export type EditorialEnvironment = "production" | "preview";

export interface EditorialSqlStatement {
  statement: string;
  params?: unknown[];
}

export interface EditorialSqlClient {
  query<T extends Record<string, unknown>>(statement: string, params?: unknown[]): Promise<T[]>;
  transaction(statements: EditorialSqlStatement[]): Promise<void>;
}

function neonClient(sql: NeonQueryFunction<false, false>): EditorialSqlClient {
  const query = async <T extends Record<string, unknown>>(
    statement: string,
    params: unknown[] = [],
  ): Promise<T[]> => await sql.query(statement, params) as T[];

  return {
    query,
    async transaction(statements: EditorialSqlStatement[]): Promise<void> {
      await sql.transaction((transactionSql) =>
        statements.map(({ statement, params = [] }) => transactionSql.query(statement, params))
      );
    },
  };
}

export function createEditorialSqlClient(connectionString = postgresConnectionString()): EditorialSqlClient {
  return neonClient(neon(connectionString, { arrayMode: false, fullResults: false }));
}

interface PublicationRow extends Record<string, unknown> {
  document: EditorialPublication;
}

interface IdRow extends Record<string, unknown> {
  id: string;
}

interface CountRow extends Record<string, unknown> {
  count: string;
}

function eventParams(
  workspaceId: string,
  environment: EditorialEnvironment,
  publicationId: string,
  event: EditorialEvent,
): unknown[] {
  return [
    workspaceId,
    environment,
    publicationId,
    event.id,
    event.type,
    event.at,
    event.actor,
    JSON.stringify(event),
  ];
}

/**
 * Definitive relational persistence for the editorial lifecycle.
 *
 * The complete domain document is stored as JSONB for contract compatibility,
 * while identity, lifecycle, timestamps and the append-only event relationship
 * are relational and constrained by the migration.
 */
export class PostgresEditorialStore implements EditorialRepository {
  constructor(
    private readonly client: EditorialSqlClient,
    private readonly workspaceId: string,
    private readonly environment: EditorialEnvironment,
  ) {
    if (!workspaceId.trim()) throw new Error("EDITORIAL_WORKSPACE_SCOPE_REQUIRED");
  }

  async listPublicationIds(): Promise<string[]> {
    const rows = await this.client.query<IdRow>(
      `SELECT id
         FROM editorial_publications
        WHERE workspace_id = $1 AND environment = $2
        ORDER BY updated_at DESC, id ASC`,
      [this.workspaceId, this.environment],
    );
    return rows.map((row) => row.id);
  }

  async getPublication(id: string): Promise<EditorialPublication | null> {
    const rows = await this.client.query<PublicationRow>(
      `SELECT document
         FROM editorial_publications
        WHERE workspace_id = $1 AND environment = $2 AND id = $3
        LIMIT 1`,
      [this.workspaceId, this.environment, id],
    );
    return rows[0]?.document ?? null;
  }

  async savePublication(publication: EditorialPublication): Promise<void> {
    const statements: EditorialSqlStatement[] = [{
      statement: `INSERT INTO editorial_publications (
           workspace_id, environment, id, version, status, title, slug,
           author, document, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz, $11::timestamptz)
         ON CONFLICT (workspace_id, environment, id) DO UPDATE SET
           version = EXCLUDED.version,
           status = EXCLUDED.status,
           title = EXCLUDED.title,
           slug = EXCLUDED.slug,
           author = EXCLUDED.author,
           document = EXCLUDED.document,
           updated_at = EXCLUDED.updated_at
         WHERE editorial_publications.updated_at <= EXCLUDED.updated_at`,
      params: [
        this.workspaceId,
        this.environment,
        publication.id,
        publication.version,
        publication.status,
        publication.briefing.title,
        publication.content.slug,
        publication.briefing.author,
        JSON.stringify(publication),
        publication.created_at,
        publication.updated_at,
      ],
    }];

    for (const event of publication.events) {
      statements.push({
        statement: `INSERT INTO editorial_events (
             workspace_id, environment, publication_id, event_id, event_type,
             occurred_at, actor, event
           )
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb)
           ON CONFLICT (workspace_id, environment, publication_id, event_id) DO NOTHING`,
        params: eventParams(this.workspaceId, this.environment, publication.id, event),
      });
    }
    await this.client.transaction(statements);
  }

  async deletePublication(id: string): Promise<boolean> {
    const rows = await this.client.query<CountRow>(
      `WITH deleted AS (
         DELETE FROM editorial_publications
          WHERE workspace_id = $1 AND environment = $2 AND id = $3
          RETURNING 1
       )
       SELECT count(*)::text AS count FROM deleted`,
      [this.workspaceId, this.environment, id],
    );
    return Number(rows[0]?.count ?? "0") > 0;
  }
}
