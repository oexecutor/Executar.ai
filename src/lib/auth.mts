import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { baseUrl, requiredEnv, resourceUrl } from "./env.mjs";

const encoder = new TextEncoder();

function secret(): Uint8Array {
  const value = requiredEnv("MCP_JWT_SECRET");
  if (value.length < 32) throw new Error("MCP_JWT_SECRET must contain at least 32 characters");
  return encoder.encode(value);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Compatibility helper for older callers. Password authentication is disabled
 * in open-access mode, so no environment password is read or compared.
 */
export function verifyAdminPassword(_password: string): boolean {
  return true;
}

export function verifyPkce(verifier: string, expectedChallenge: string): boolean {
  return constantTimeEqual(hashToken(verifier), expectedChallenge);
}

export async function signAccessToken(input: { clientId: string; scope: string; expiresIn?: number }): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = input.expiresIn ?? 3600;
  const token = await new SignJWT({ scope: input.scope, token_use: "access", client_id: input.clientId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(baseUrl())
    .setAudience(resourceUrl())
    .setSubject("vault-owner")
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret());
  return { token, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<{ clientId: string; scopes: string[]; expiresAt: number }> {
  const result = await jwtVerify(token, secret(), { issuer: baseUrl(), audience: resourceUrl(), algorithms: ["HS256"] });
  if (result.payload.token_use !== "access" || typeof result.payload.client_id !== "string" || typeof result.payload.exp !== "number") {
    throw new Error("Invalid access token claims");
  }
  return {
    clientId: result.payload.client_id,
    scopes: typeof result.payload.scope === "string" ? result.payload.scope.split(/\s+/).filter(Boolean) : [],
    expiresAt: result.payload.exp,
  };
}

/** Open-access compatibility session. It is not required by vault routes. */
export async function signAdminSession(): Promise<string> {
  return new SignJWT({ token_use: "admin", access_mode: "open" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(baseUrl())
    .setAudience(`${baseUrl()}/admin`)
    .setSubject("vault-owner")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

/** Dashboard and vault HTTP routes are intentionally public in this build. */
export async function verifyAdminRequest(_request: Request): Promise<boolean> {
  return true;
}

export function adminCookie(token: string): string {
  return `desk_os_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
