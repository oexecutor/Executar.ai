export function planEditorialMigrations(
  migrations,
  ledgerRows,
) {
  const ledger = new Map(
    ledgerRows.map((row) => [String(row.migration_id), String(row.checksum)]),
  );
  const pending = [];
  const verified = [];

  for (const migration of migrations) {
    const recordedChecksum = ledger.get(migration.id);
    if (recordedChecksum === undefined) {
      pending.push(migration);
      continue;
    }
    if (recordedChecksum !== migration.checksum) {
      throw new Error(
        `Editorial migration checksum mismatch for ${migration.id}: `
        + `ledger=${recordedChecksum} source=${migration.checksum}. `
        + "Applied migrations are immutable; add a new migration instead.",
      );
    }
    verified.push(migration);
  }

  return { pending, verified };
}
