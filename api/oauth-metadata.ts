import { baseUrl, resourceUrl } from "../src/lib/env.mjs";
import { corsPreflight, json, safeError, withCors } from "../src/lib/http.mjs";

export default async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return corsPreflight(["GET"]);
  try {
    const pathname = new URL(request.url).pathname;
    if (pathname.includes("oauth-protected-resource")) {
      return withCors(json({
        resource: resourceUrl(),
        authorization_servers: [baseUrl()],
        scopes_supported: ["mcp:tools"],
        bearer_methods_supported: ["header"],
      }));
    }
    return withCors(json({
      issuer: baseUrl(),
      authorization_endpoint: `${baseUrl()}/oauth/authorize`,
      token_endpoint: `${baseUrl()}/oauth/token`,
      registration_endpoint: `${baseUrl()}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools", "offline_access"],
    }));
  } catch (error) {
    return withCors(safeError(error));
  }
};
