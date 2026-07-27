import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const canonicalProject = "executar-ai";
const projectName = process.env.VERCEL_PROJECT_NAME?.trim();
const required = process.argv.includes("--require") || projectName === canonicalProject;

if (projectName && projectName !== canonicalProject) {
  console.log(`Editorial migration skipped for non-canonical project ${projectName}.`);
  process.exit(0);
}

const connectionNames = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];
const connectionString = connectionNames
  .map((name) => process.env[name]?.trim())
  .find(Boolean);

if (!connectionString) {
  if (required) {
    throw new Error(`Editorial migration requires one of: ${connectionNames.join(", ")}`);
  }
  console.log("Editorial migration skipped outside the canonical Vercel project (database not configured).");
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase/migrations/202607270001_editorial_postgres.sql");
const migration = await fs.readFile(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(migration).digest("hex");
const statements = migration
  .split(/\n-- statement-breakpoint\n/g)
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(connectionString, { arrayMode: false, fullResults: false });
await sql.transaction((transactionSql) =>
  statements.map((statement) => transactionSql.query(statement))
);

await sql.query(
  `UPDATE public.app_schema_migrations
      SET checksum = $1
    WHERE migration_id = '202607270001_editorial_postgres'`,
  [checksum],
);

const counts = await sql.query(
  `SELECT
     (SELECT count(*)::integer FROM public.editorial_legacy_backup) AS backup_rows,
     (SELECT count(*)::integer FROM public.editorial_publications) AS publication_rows,
     (SELECT count(*)::integer FROM public.editorial_events) AS event_rows`,
);
const evidence = counts[0] ?? {};
console.log(JSON.stringify({
  migration: "202607270001_editorial_postgres",
  checksum,
  backup_rows: evidence.backup_rows ?? 0,
  publication_rows: evidence.publication_rows ?? 0,
  event_rows: evidence.event_rows ?? 0,
}));
