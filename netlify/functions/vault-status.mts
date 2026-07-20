import type { Config } from "@netlify/functions";
import { requireAdminJson } from "../../src/lib/admin-guard.mjs";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";
import { vaultStore } from "../../src/lib/stores.mjs";
import { BlobVaultService } from "../../src/lib/vault.mjs";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const denied = await requireAdminJson(request);
  if (denied) return denied;
  try {
    return json(await new BlobVaultService(vaultStore()).info());
  } catch (error) {
    return safeError(error);
  }
};

export const config: Config = { path: "/api/vault/status" };
