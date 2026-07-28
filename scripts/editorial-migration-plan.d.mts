export interface EditorialMigrationDescriptor {
  id: string;
  checksum: string;
}

export interface EditorialMigrationLedgerRow {
  migration_id: string;
  checksum: string;
}

export function planEditorialMigrations<
  Migration extends EditorialMigrationDescriptor,
>(
  migrations: readonly Migration[],
  ledgerRows: readonly EditorialMigrationLedgerRow[],
): {
  pending: Migration[];
  verified: Migration[];
};
