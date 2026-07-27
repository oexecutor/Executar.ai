import fs from "node:fs/promises";
import { PGlite, type PGliteInterface } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEditorialSqlClient,
  PostgresEditorialStore,
  type EditorialSqlClient,
  type EditorialSqlStatement,
} from "../src/editorial/postgres-store.js";
import { EditorialService } from "../src/editorial/service.js";
import { EditorialStore, MigratingEditorialStore } from "../src/editorial/store.js";
import { memoryStore } from "./helpers/memory-store.js";

const migrationUrl = new URL(
  "../supabase/migrations/202607270001_editorial_postgres.sql",
  import.meta.url,
);

const article = `# Persistência editorial relacional

## Contexto

Esta publicação descartável comprova criação, atualização, validação, revisão,
aprovação e publicação no adapter Postgres sem usar dados reais do usuário.

## Operação

O mesmo registro deve permanecer acessível por uma nova instância do
repositório, isolado por workspace e acompanhado por eventos imutáveis.`;

function briefing(suffix = "") {
  return {
    title: `Persistência editorial relacional${suffix}`,
    summary: "Teste de migração do Editorial V2.",
    audience: "Equipe EXECUTA.AI",
    objective: "Comprovar persistência e isolamento.",
    author: "Teste automatizado",
    source_text: article,
  };
}

function pgliteClient(database: PGliteInterface): EditorialSqlClient {
  return {
    async query<Row extends Record<string, unknown>>(
      statement: string,
      params: unknown[] = [],
    ): Promise<Row[]> {
      return (await database.query<Row>(statement, params)).rows;
    },
    async transaction(statements: EditorialSqlStatement[]): Promise<void> {
      await database.transaction(async (transaction) => {
        for (const { statement, params = [] } of statements) {
          await transaction.query(statement, params);
        }
      });
    },
  };
}

async function applyMigration(database: PGliteInterface): Promise<void> {
  const migration = await fs.readFile(migrationUrl, "utf8");
  const statements = migration
    .split(/\n-- statement-breakpoint\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
  await database.transaction(async (transaction) => {
    for (const statement of statements) await transaction.exec(statement);
  });
}

async function legacyPublication() {
  const service = new EditorialService(new EditorialStore(memoryStore()));
  return await service.createPublication(briefing(" legado"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Editorial Postgres migration", () => {
  it("creates an empty database and remains idempotent", async () => {
    const database = new PGlite();
    await applyMigration(database);
    await applyMigration(database);

    const counts = await database.query<{
      publications: number;
      backups: number;
      migrations: number;
    }>(`
      select
        (select count(*)::integer from editorial_publications) as publications,
        (select count(*)::integer from editorial_legacy_backup) as backups,
        (select count(*)::integer from app_schema_migrations) as migrations
    `);
    expect(counts.rows[0]).toEqual({ publications: 0, backups: 0, migrations: 1 });
    await database.close();
  });

  it("backs up and backfills existing KV data without deleting the source", async () => {
    const database = new PGlite();
    const publication = await legacyPublication();
    await database.exec(`
      create table kv_store (
        namespace text not null,
        key text not null,
        value jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (namespace, key)
      )
    `);
    await database.query(
      `insert into kv_store (namespace, key, value)
       values ($1, $2, $3::jsonb)`,
      ["obsidian-vault-production", `editorial/publication/${publication.id}`, JSON.stringify(publication)],
    );

    await applyMigration(database);
    const repository = new PostgresEditorialStore(pgliteClient(database), "public", "production");
    expect(await repository.getPublication(publication.id)).toEqual(publication);

    const evidence = await database.query<{
      source_rows: number;
      backup_rows: number;
      publication_rows: number;
      event_rows: number;
    }>(`
      select
        (select count(*)::integer from kv_store) as source_rows,
        (select count(*)::integer from editorial_legacy_backup) as backup_rows,
        (select count(*)::integer from editorial_publications) as publication_rows,
        (select count(*)::integer from editorial_events) as event_rows
    `);
    expect(evidence.rows[0]).toEqual({
      source_rows: 1,
      backup_rows: 1,
      publication_rows: 1,
      event_rows: publication.events.length,
    });

    await applyMigration(database);
    expect((await repository.listPublicationIds())).toEqual([publication.id]);
    await database.close();
  });
});

describe("MigratingEditorialStore", () => {
  it("repairs the primary from legacy reads and keeps rollback dual writes current", async () => {
    const legacy = new EditorialStore(memoryStore());
    const primary = new EditorialStore(memoryStore());
    const publication = await new EditorialService(legacy).createPublication(briefing(" dual write"));
    const migration = new MigratingEditorialStore(primary, legacy);

    expect(await primary.getPublication(publication.id)).toBeNull();
    expect(await migration.getPublication(publication.id)).toEqual(publication);
    expect(await primary.getPublication(publication.id)).toEqual(publication);

    const service = new EditorialService(migration);
    const updated = await service.updateContent(publication.id, {
      markdown: `${article}\n\n## Rollback\n\nA cópia KV acompanha a fonte relacional.`,
      actor: "Teste automatizado",
    });
    expect(await primary.getPublication(publication.id)).toEqual(updated);
    expect(await legacy.getPublication(publication.id)).toEqual(updated);
  });
});

describe("PostgresEditorialStore", () => {
  it("persists the complete lifecycle across repository instances and isolates workspaces", async () => {
    const database = new PGlite();
    await applyMigration(database);
    const client = pgliteClient(database);
    const workspaceA = new PostgresEditorialStore(client, "workspace-a", "preview");
    const workspaceB = new PostgresEditorialStore(client, "workspace-b", "preview");
    const service = new EditorialService(workspaceA);

    const created = await service.createPublication(briefing());
    await service.updateContent(created.id, {
      markdown: `${article}\n\n## Evidência\n\nConteúdo atualizado e salvo no Postgres.`,
      actor: "Teste automatizado",
    });
    await service.runQualityGate(created.id, "Teste automatizado");
    await service.startPreview(created.id, {
      branch: "editorial/persistencia-relacional",
      commit_sha: "a".repeat(40),
      actor: "Teste automatizado",
    });
    await service.attachPreview(created.id, {
      url: "https://preview.example.test/blog/persistencia-relacional",
      deployment_id: "dpl_test",
      actor: "Teste automatizado",
    });
    await service.startReview(created.id, "Teste automatizado");
    await expect(service.startPublishing(created.id, "Teste automatizado"))
      .rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await service.review(created.id, {
      decision: "APPROVED",
      reviewer: "Teste automatizado",
    });
    await service.startPublishing(created.id, "Teste automatizado");
    await service.markPublished(created.id, {
      url: "https://executar-ai.vercel.app/blog/persistencia-relacional",
      commit_sha: "a".repeat(40),
      actor: "Teste automatizado",
    });

    const restarted = new PostgresEditorialStore(client, "workspace-a", "preview");
    expect((await restarted.getPublication(created.id))?.status).toBe("PUBLISHED");
    expect(await restarted.listPublicationIds()).toEqual([created.id]);
    expect(await workspaceB.getPublication(created.id)).toBeNull();
    expect(await workspaceB.listPublicationIds()).toEqual([]);

    const eventCount = await database.query<{ count: number }>(
      `select count(*)::integer as count
         from editorial_events
        where workspace_id = $1 and environment = $2 and publication_id = $3`,
      ["workspace-a", "preview", created.id],
    );
    expect(eventCount.rows[0]?.count).toBeGreaterThanOrEqual(8);

    expect(await restarted.deletePublication(created.id)).toBe(true);
    expect(await restarted.getPublication(created.id)).toBeNull();
    expect(await restarted.deletePublication(created.id)).toBe(false);
    await database.close();
  });

  it("persists a requested-changes decision", async () => {
    const database = new PGlite();
    await applyMigration(database);
    const store = new PostgresEditorialStore(pgliteClient(database), "workspace-review", "preview");
    const service = new EditorialService(store);
    const created = await service.createPublication(briefing(" revisão"));
    await service.runQualityGate(created.id, "Teste automatizado");
    await service.startPreview(created.id, {
      branch: "editorial/revisao",
      commit_sha: "b".repeat(40),
      actor: "Teste automatizado",
    });
    await service.attachPreview(created.id, {
      url: "https://preview.example.test/blog/revisao",
      actor: "Teste automatizado",
    });
    await service.startReview(created.id, "Teste automatizado");
    const reviewed = await service.review(created.id, {
      decision: "CHANGES_REQUESTED",
      reviewer: "Teste automatizado",
      note: "Ajustar evidências.",
    });
    expect(reviewed.status).toBe("CHANGES_REQUESTED");
    expect((await store.getPublication(created.id))?.approval.note).toBe("Ajustar evidências.");
    await database.close();
  });

  it("fails safely when the schema or database configuration is absent", async () => {
    const database = new PGlite();
    const store = new PostgresEditorialStore(pgliteClient(database), "workspace-a", "preview");
    await expect(store.listPublicationIds()).rejects.toThrow(/editorial_publications/i);
    await database.close();

    for (const name of [
      "DATABASE_URL",
      "POSTGRES_URL",
      "DATABASE_URL_UNPOOLED",
      "POSTGRES_URL_NON_POOLING",
    ]) {
      vi.stubEnv(name, "");
    }
    expect(() => createEditorialSqlClient()).toThrow(/No Postgres connection string/);
  });
});
