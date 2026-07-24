import { verifyAppSession, verifyAdminRequest, type AppSession } from "./auth.js";
import {
  authenticateSupabaseUser,
  getOrCreatePublicWorkspace,
  getWorkspaceMembershipAsService,
  listWorkspaceMemberships,
  supabaseConfigured,
} from "./supabase.js";

export interface AuthenticatedRequest {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  accessToken?: string;
}

export function canWriteWorkspace(auth: AuthenticatedRequest): boolean {
  return auth.role === "OWNER" || auth.role === "ADMIN" || auth.role === "EDITOR";
}

const cache = new WeakMap<Request, Promise<AuthenticatedRequest | null>>();

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function fromSession(session: AppSession): AuthenticatedRequest {
  return {
    userId: session.userId,
    email: session.email,
    workspaceId: session.workspaceId,
    workspaceName: session.workspaceName,
    role: session.role,
  };
}

async function resolve(request: Request): Promise<AuthenticatedRequest | null> {
  const accessToken = bearer(request);
  if (accessToken) {
    const workspaceId = request.headers.get("x-workspace-id")?.trim();
    if (!workspaceId) return null;
    const user = await authenticateSupabaseUser(accessToken);
    if (!user) return null;
    const membership = (await listWorkspaceMemberships(accessToken, user.id))
      .find((candidate) => candidate.workspaceId === workspaceId);
    if (!membership) return null;
    return {
      userId: user.id,
      email: user.email,
      workspaceId,
      workspaceName: membership.workspaceName,
      role: membership.role,
      accessToken,
    };
  }

  const session = await verifyAppSession(request);
  if (session) {
    if (!supabaseConfigured()) return process.env.NODE_ENV === "test" ? fromSession(session) : null;
    try {
      const membership = await getWorkspaceMembershipAsService(session.userId, session.workspaceId);
      if (!membership) return null;
      return {
        userId: session.userId,
        email: session.email,
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspaceName,
        role: membership.role,
      };
    } catch {
      return null;
    }
  }

  // The legacy admin cookie is accepted only by tests.
  if (process.env.NODE_ENV === "test" && await verifyAdminRequest(request)) {
    return {
      userId: "test-operator",
      email: "operator@example.test",
      workspaceId: "wsp_test",
      workspaceName: "Test workspace",
      role: "OWNER",
    };
  }

  // Login was removed at the operator's explicit, repeated request: no
  // request should ever be blocked waiting on a sign-in step. Every caller
  // without a real session shares a single public workspace instead.
  if (process.env.NODE_ENV === "test") return null;
  if (!supabaseConfigured()) {
    return { userId: "public", email: null, workspaceId: "public", workspaceName: "Workspace público", role: "OWNER" };
  }
  try {
    const workspace = await getOrCreatePublicWorkspace();
    return {
      userId: "public",
      email: null,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      role: "OWNER",
    };
  } catch {
    return null;
  }
}

export function getAuthenticatedRequest(request: Request): Promise<AuthenticatedRequest | null> {
  const cached = cache.get(request);
  if (cached) return cached;
  const pending = resolve(request);
  cache.set(request, pending);
  return pending;
}
