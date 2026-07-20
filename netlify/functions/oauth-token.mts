import type { Config } from "@netlify/functions";
import { hashToken, randomToken, signAccessToken, verifyPkce } from "../../src/lib/auth.mjs";
import { resourceUrl } from "../../src/lib/env.mjs";
import { json, methodNotAllowed, safeError } from "../../src/lib/http.mjs";
import { oauthStore } from "../../src/lib/stores.mjs";
import type { AuthorizationCode, RefreshGrant } from "../../src/lib/types.mjs";

async function issue(clientId: string, scope: string, resource: string): Promise<Response> {
  const access = await signAccessToken({ clientId, scope });
  const refreshToken = randomToken(48);
  const grant: RefreshGrant = { clientId, scope, resource, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 };
  await oauthStore().setJSON(`refresh/${hashToken(refreshToken)}`, grant);
  return json({ access_token: access.token, token_type: "Bearer", expires_in: access.expiresIn, refresh_token: refreshToken, scope });
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const form = new URLSearchParams(await request.text());
    const grantType = form.get("grant_type");
    if (grantType === "authorization_code") {
      const code = form.get("code") ?? "";
      const codeKey = `code/${hashToken(code)}`;
      const record = await oauthStore().get(codeKey, { type: "json" }) as AuthorizationCode | null;
      if (!record || record.expiresAt < Date.now()) return json({ error: "invalid_grant" }, { status: 400 });
      if (form.get("client_id") !== record.clientId || form.get("redirect_uri") !== record.redirectUri) return json({ error: "invalid_grant" }, { status: 400 });
      if (form.get("resource") !== record.resource || record.resource !== resourceUrl()) return json({ error: "invalid_target" }, { status: 400 });
      if (!verifyPkce(form.get("code_verifier") ?? "", record.codeChallenge)) return json({ error: "invalid_grant" }, { status: 400 });
      await oauthStore().delete(codeKey);
      return issue(record.clientId, record.scope, record.resource);
    }
    if (grantType === "refresh_token") {
      const refresh = form.get("refresh_token") ?? "";
      const key = `refresh/${hashToken(refresh)}`;
      const record = await oauthStore().get(key, { type: "json" }) as RefreshGrant | null;
      if (!record || record.expiresAt < Date.now() || form.get("client_id") !== record.clientId || form.get("resource") !== record.resource) {
        return json({ error: "invalid_grant" }, { status: 400 });
      }
      await oauthStore().delete(key);
      return issue(record.clientId, record.scope, record.resource);
    }
    return json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (error) {
    return safeError(error);
  }
};

export const config: Config = { path: "/oauth/token" };
