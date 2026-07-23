import { PostgresKvStore, type KvStore } from "./kv-store.js";
import { isProduction } from "./env.js";

function scopedStore(productionNamespace: string, previewNamespace: string): KvStore {
  return new PostgresKvStore(isProduction() ? productionNamespace : previewNamespace);
}

export function vaultStore(): KvStore {
  return scopedStore("obsidian-vault-production", "obsidian-vault-preview");
}

export function oauthStore(): KvStore {
  return scopedStore("obsidian-oauth-production", "obsidian-oauth-preview");
}
