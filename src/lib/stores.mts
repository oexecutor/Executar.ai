import { getDeployStore, getStore, type Store } from "@netlify/blobs";
import { isProduction } from "./env.mjs";

function scopedStore(productionName: string, previewName: string): Store {
  if (isProduction()) return getStore({ name: productionName, consistency: "strong" });
  return getDeployStore({ name: previewName, consistency: "strong" });
}

export function vaultStore(): Store {
  return scopedStore("obsidian-vault-production", "obsidian-vault-preview");
}

export function oauthStore(): Store {
  return scopedStore("obsidian-oauth-production", "obsidian-oauth-preview");
}
