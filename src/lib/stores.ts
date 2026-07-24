import { OAuthPostgresStore, PostgresKvStore, type KvStore } from "./kv-store.js";
import { isProduction } from "./env.js";
import { SupabaseKvStore, supabaseConfigured } from "./supabase.js";

function scopedStore(productionNamespace: string, previewNamespace: string): KvStore {
  return new PostgresKvStore(isProduction() ? productionNamespace : previewNamespace);
}

export interface VaultStoreScope {
  workspaceId?: string;
  accessToken?: string;
}

export function vaultStore(scope: VaultStoreScope = {}): KvStore {
  if (supabaseConfigured()) {
    if (!scope.workspaceId) throw new Error("WORKSPACE_SCOPE_REQUIRED");
    return new SupabaseKvStore(
      scope.workspaceId,
      `${scope.workspaceId}:${isProduction() ? "executa-vault-production" : "executa-vault-preview"}`,
      scope.accessToken,
    );
  }
  return scopedStore("obsidian-vault-production", "obsidian-vault-preview");
}

export function oauthStore(): KvStore {
  return new OAuthPostgresStore(isProduction() ? "obsidian-oauth-production" : "obsidian-oauth-preview");
}
