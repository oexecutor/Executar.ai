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

/** True when the operator password is configured in the environment. */
export function adminAuthConfigured(): boolean {
  return Boolean(Netlify.env.get("ADMIN_PASSWORD")?.trim());
}

/**
 * Gate 0.5 (baseline §13, Option B): real operator password check. Digests
 * are compared with timingSafeEqual and the check fails closed when
 * ADMIN_PASSWORD is not configured.
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = Netlify.env.get("ADMIN_PASSWORD")?.trim();
  if (!expected || typeof password !== "string" || password.length === 0) return false;
  return constantTimeEqual(hashToken(password), hashToken(expected));
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

const ADMIN_COOKIE = "desk_os_admin";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

/** Operator session issued by admin-login after a successful password check. */
export async function signAdminSession(): Promise<string> {
  return new SignJWT({ token_use: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(baseUrl())
    .setAudience(`${baseUrl()}/admin`)
    .setSubject("vault-owner")
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_SECONDS}s`)
    .sign(secret());
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return rest.join("=");
  }
  return undefined;
}

/** True only when the request carries a valid, unexpired admin session cookie. */
export async function verifyAdminRequest(request: Request): Promise<boolean> {
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return false;
  try {
    const result = await jwtVerify(token, secret(), {
      issuer: baseUrl(),
      audience: `${baseUrl()}/admin`,
      algorithms: ["HS256"],
    });
    return result.payload.token_use === "admin";
  } catch {
    return false;
  }
}

export function adminCookie(token: string): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_SECONDS}`;
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
