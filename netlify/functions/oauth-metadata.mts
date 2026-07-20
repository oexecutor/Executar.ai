import type { Config } from "@netlify/functions";
import { baseUrl, resourceUrl } from "../../src/lib/env.mjs";
import { json, safeError } from "../../src/lib/http.mjs";

export default async (request: Request): Promise<Response> => {
  try {
    const pathname = new URL(request.url).pathname;
    if (pathname.includes("oauth-protected-resource")) {
      return json({
        resource: resourceUrl(),
        authorization_servers: [baseUrl()],
        scopes_supported: ["mcp:tools"],
        bearer_methods_supported: ["header"],
      });
    }
    return json({
      issuer: baseUrl(),
      authorization_endpoint: `${baseUrl()}/oauth/authorize`,
      token_endpoint: `${baseUrl()}/oauth/token`,
      registration_endpoint: `${baseUrl()}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools", "offline_access"],
    });
  } catch (error) {
    return safeError(error);
  }
};

export const config: Config = {
  path: [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
    "/.well-known/oauth-authorization-server",
  ],
};
