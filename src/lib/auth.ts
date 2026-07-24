import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { baseUrl, requiredEnv, resourceUrl } from "./env.js";

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
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

/**
 * Gate 0.5 (baseline §13, Option B): real operator password check. Digests
 * are compared with timingSafeEqual and the check fails closed when
 * ADMIN_PASSWORD is not configured.
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected || typeof password !== "string" || password.length === 0) return false;
  return constantTimeEqual(hashToken(password), hashToken(expected));
}

export function verifyPkce(verifier: string, expectedChallenge: string): boolean {
  return constantTimeEqual(hashToken(verifier), expectedChallenge);
}

export async function signAccessToken(input: {
  clientId: string;
  userId: string;
  workspaceId: string;
  scope: string;
  expiresIn?: number;
}): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = input.expiresIn ?? 3600;
  const token = await new SignJWT({
    scope: input.scope,
    token_use: "access",
    client_id: input.clientId,
    workspace_id: input.workspaceId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(baseUrl())
    .setAudience(resourceUrl())
    .setSubject(input.userId)
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret());
  return { token, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<{
  clientId: string;
  userId: string;
  workspaceId: string;
  scopes: string[];
  expiresAt: number;
}> {
  const result = await jwtVerify(token, secret(), { issuer: baseUrl(), audience: resourceUrl(), algorithms: ["HS256"] });
  if (
    result.payload.token_use !== "access" ||
    typeof result.payload.client_id !== "string" ||
    typeof result.payload.sub !== "string" ||
    typeof result.payload.workspace_id !== "string" ||
    typeof result.payload.exp !== "number"
  ) {
    throw new Error("Invalid access token claims");
  }
  return {
    clientId: result.payload.client_id,
    userId: result.payload.sub,
    workspaceId: result.payload.workspace_id,
    scopes: typeof result.payload.scope === "string" ? result.payload.scope.split(/\s+/).filter(Boolean) : [],
    expiresAt: result.payload.exp,
  };
}

const ADMIN_COOKIE = "desk_os_admin";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const APP_COOKIE = "executa_session";
const APP_SESSION_SECONDS = 12 * 60 * 60;

export interface AppSession {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}

export async function signAppSession(input: AppSession): Promise<string> {
  return new SignJWT({
    token_use: "app",
    email: input.email,
    workspace_id: input.workspaceId,
    workspace_name: input.workspaceName,
    role: input.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(baseUrl())
    .setAudience(`${baseUrl()}/app`)
    .setSubject(input.userId)
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${APP_SESSION_SECONDS}s`)
    .sign(secret());
}

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

export async function verifyAppSession(request: Request): Promise<AppSession | null> {
  const token = readCookie(request, APP_COOKIE);
  if (!token) return null;
  try {
    const result = await jwtVerify(token, secret(), {
      issuer: baseUrl(),
      audience: `${baseUrl()}/app`,
      algorithms: ["HS256"],
    });
    const payload = result.payload;
    if (
      payload.token_use !== "app" ||
      typeof payload.sub !== "string" ||
      typeof payload.workspace_id !== "string" ||
      typeof payload.workspace_name !== "string" ||
      !["OWNER", "ADMIN", "EDITOR", "VIEWER"].includes(String(payload.role))
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      workspaceId: payload.workspace_id,
      workspaceName: payload.workspace_name,
      role: payload.role as AppSession["role"],
    };
  } catch {
    return null;
  }
}

export function appCookie(token: string): string {
  const secure = baseUrl().startsWith("https://") ? "; Secure" : "";
  return `${APP_COOKIE}=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${APP_SESSION_SECONDS}`;
}

export function clearAppCookie(): string {
  const secure = baseUrl().startsWith("https://") ? "; Secure" : "";
  return `${APP_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
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
