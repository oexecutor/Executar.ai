import { BlobVaultService } from "./vault.mjs";
import { vaultStore } from "./stores.mjs";

let override: BlobVaultService | null = null;

/** Tests inject an in-memory vault; production lazily binds Netlify Blobs. */
export function setVaultForTesting(vault: BlobVaultService | null): void {
  override = vault;
}

export function activeVault(): BlobVaultService {
  return override ?? new BlobVaultService(vaultStore());
}
