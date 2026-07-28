import crypto from "node:crypto";
import type { EditorialSqlClient, EditorialSqlStatement } from "./postgres-store.js";
import type {
  EditorialQrAccessOutcome,
  EditorialQrRegistration,
  EditorialQrRepository,
  EditorialQrResolverRepository,
  ResolvedEditorialQr,
} from "./qr.js";
import { EDITORIAL_QR_TOKEN_PATTERN } from "./qr.js";
import type {
  EditorialPublication,
  EditorialQrAccessPolicy,
  EditorialQrAction,
} from "./types.js";
import { EDITORIAL_QR_ACTIONS } from "./types.js";

interface QrRouteRow extends Record<string, unknown> {
  publication_id: string;
  action: EditorialQrAction;
  token: string;
  status: "ACTIVE" | "REVOKED";
  access_policy: EditorialQrAccessPolicy;
  issued_at: string;
  issued_by: string;
}

interface ResolvedQrRouteRow extends QrRouteRow {
  document: EditorialPublication;
}

function registration(row: QrRouteRow): EditorialQrRegistration {
  return {
    publication_id: row.publication_id,
    action: row.action,
    token: row.token,
    status: row.status,
    access_policy: row.access_policy,
    issued_at: new Date(row.issued_at).toISOString(),
    issued_by: row.issued_by,
  };
}

/**
 * Normalized QR registry. Destinations deliberately remain outside this table:
 * each scan resolves the semantic action against the current publication
 * document, preserving printed tokens when providers or Preview URLs change.
 */
export class PostgresEditorialQrStore
  implements EditorialQrRepository, EditorialQrResolverRepository {
  constructor(
    private readonly client: EditorialSqlClient,
    private readonly environment: "production" | "preview",
    private readonly workspaceId?: string,
  ) {}

  async listRoutes(
    publicationId: string,
  ): Promise<EditorialQrRegistration[]> {
    if (!this.workspaceId) throw new Error("EDITORIAL_QR_WORKSPACE_SCOPE_REQUIRED");
    const rows = await this.client.query<QrRouteRow>(
      `SELECT publication_id, action, token, status, access_policy,
              issued_at, issued_by
         FROM editorial_qr_routes
        WHERE workspace_id = $1
          AND environment = $2
          AND publication_id = $3
        ORDER BY action ASC`,
      [this.workspaceId, this.environment, publicationId],
    );
    return rows.map(registration);
  }

  async saveRoutes(
    publicationId: string,
    routes: EditorialQrRegistration[],
  ): Promise<void> {
    if (!this.workspaceId) throw new Error("EDITORIAL_QR_WORKSPACE_SCOPE_REQUIRED");
    const actions = new Set<EditorialQrAction>();
    const statements: EditorialSqlStatement[] = [];
    for (const route of routes) {
      if (
        route.publication_id !== publicationId
        || !EDITORIAL_QR_ACTIONS.includes(route.action)
        || !EDITORIAL_QR_TOKEN_PATTERN.test(route.token)
        || actions.has(route.action)
      ) {
        throw new Error("EDITORIAL_QR_REGISTRATION_INVALID");
      }
      actions.add(route.action);
      statements.push({
        statement: `INSERT INTO editorial_qr_routes (
             workspace_id, environment, publication_id, action, token,
             status, access_policy, issued_at, issued_by, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $8::timestamptz)
           ON CONFLICT (workspace_id, environment, publication_id, action)
           DO UPDATE SET
             status = EXCLUDED.status,
             access_policy = EXCLUDED.access_policy,
             issued_by = EXCLUDED.issued_by,
             updated_at = EXCLUDED.updated_at`,
        params: [
          this.workspaceId,
          this.environment,
          publicationId,
          route.action,
          route.token,
          route.status,
          route.access_policy,
          route.issued_at,
          route.issued_by,
        ],
      });
    }
    if (statements.length) await this.client.transaction(statements);
  }

  async resolveRoute(token: string): Promise<ResolvedEditorialQr | null> {
    if (!EDITORIAL_QR_TOKEN_PATTERN.test(token)) return null;
    const rows = await this.client.query<ResolvedQrRouteRow>(
      `SELECT route.publication_id, route.action, route.token, route.status,
              route.access_policy, route.issued_at, route.issued_by,
              publication.document
         FROM editorial_qr_routes route
         JOIN editorial_publications publication
           ON publication.workspace_id = route.workspace_id
          AND publication.environment = route.environment
          AND publication.id = route.publication_id
        WHERE route.environment = $1
          AND route.token = $2
        LIMIT 1`,
      [this.environment, token],
    );
    const row = rows[0];
    return row
      ? {
          registration: registration(row),
          publication: row.document,
        }
      : null;
  }

  async recordAccess(
    token: string,
    outcome: EditorialQrAccessOutcome,
    occurredAt: string,
  ): Promise<void> {
    if (!EDITORIAL_QR_TOKEN_PATTERN.test(token)) return;
    await this.client.query(
      `INSERT INTO editorial_qr_access_events (
           event_id, route_token, occurred_at, outcome
         )
         SELECT $1, token, $2::timestamptz, $3
           FROM editorial_qr_routes
          WHERE token = $4 AND environment = $5
         ON CONFLICT (event_id) DO NOTHING`,
      [
        `qre_${crypto.randomUUID()}`,
        occurredAt,
        outcome,
        token,
        this.environment,
      ],
    );
  }
}
