import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { optionalEnv, requiredEnv } from "./env.mjs";
import { VaultProblem } from "./http.mjs";

const SESSION_COOKIE = "desk_os_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MCP_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const ISSUER = "desk-os";
const ADMIN_AUDIENCE = "desk-os-admin";
const MCP_AUDIENCE = "desk-os-mcp";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf-8").digest();
}

/**
 * Gate 0.5 (baseline §13, Option B): a real operator password check.
 * Compares SHA-256 digests with timingSafeEqual so comparison time does not
 * depend on either value. Fails closed when ADMIN_PASSWORD is not set.
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = optionalEnv("ADMIN_PASSWORD");
  if (!expected) {
    throw new VaultProblem(
      "auth_not_configured",
      "Admin authentication is not configured.",
      "Set the ADMIN_PASSWORD environment variable.",
      503,
    );
  }
  if (typeof password !== "string" || password.length === 0) return false;
  return timingSafeEqual(sha256(password), sha256(expected));
}

export function createAdminSessionToken(): string {
  return jwt.sign({ jti: randomUUID() }, requiredEnv("MCP_JWT_SECRET"), {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: ADMIN_AUDIENCE,
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function adminSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearAdminSessionCookie(): string {
  return [`${SESSION_COOKIE}=`, "Max-Age=0", "Path=/", "HttpOnly", "Secure", "SameSite=Lax"].join("; ");
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function verifyToken(token: string, audience: string): boolean {
  try {
    jwt.verify(token, requiredEnv("MCP_JWT_SECRET"), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience,
    });
    return true;
  } catch {
    return false;
  }
}

/** True when the request carries a valid, unexpired admin session cookie. */
export async function verifyAdminRequest(request: Request): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE);
  return token !== undefined && verifyToken(token, ADMIN_AUDIENCE);
}

/** Throws a 401 VaultProblem unless the request is an authenticated admin. */
export async function requireAdmin(request: Request): Promise<void> {
  if (!(await verifyAdminRequest(request))) {
    throw new VaultProblem(
      "unauthorized",
      "Authentication required.",
      "Log in via POST /api/admin-login.",
      401,
    );
  }
}

/**
 * Interim MCP credential (see docs/RECONSTRUCTION_NOTES.md): a bearer token
 * minted by an authenticated admin, replacing the lost OAuth/PKCE stack
 * until it is rebuilt from the original source.
 */
export function createMcpAccessToken(): string {
  return jwt.sign({ jti: randomUUID() }, requiredEnv("MCP_JWT_SECRET"), {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: MCP_AUDIENCE,
    expiresIn: MCP_TOKEN_TTL_SECONDS,
  });
}

export async function verifyMcpRequest(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return false;
  return verifyToken(header.slice(7).trim(), MCP_AUDIENCE);
}

export async function requireMcp(request: Request): Promise<void> {
  if (!(await verifyMcpRequest(request))) {
    throw new VaultProblem(
      "unauthorized",
      "A valid MCP bearer token is required.",
      "Mint one via POST /api/admin-mcp-token while logged in as admin.",
      401,
    );
  }
}
