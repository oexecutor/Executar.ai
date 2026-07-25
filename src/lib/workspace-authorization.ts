import {
  getSupabasePublicConfig,
  getWorkspaceMembershipAsService,
  type WorkspaceMembership,
} from "./supabase.js";

const PUBLIC_USER_ID = "public";
const PUBLIC_WORKSPACE_ID = "public";

/**
 * Resolves the workspace authorization model used by OAuth and the MCP route.
 *
 * The application has two supported operating modes:
 * - Supabase mode: a real, active workspace membership is required and is
 *   revalidated with the server-only service role key.
 * - Public workspace mode: when Supabase is intentionally not configured,
 *   only the canonical public identity may access the canonical public
 *   workspace backed by the existing Postgres store.
 *
 * A partially configured Supabase environment still fails closed inside
 * getWorkspaceMembershipAsService instead of silently becoming public.
 */
export async function resolveAuthorizedWorkspace(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership | null> {
  if (getSupabasePublicConfig()) {
    return getWorkspaceMembershipAsService(userId, workspaceId);
  }

  if (userId !== PUBLIC_USER_ID || workspaceId !== PUBLIC_WORKSPACE_ID) {
    return null;
  }

  return {
    workspaceId: PUBLIC_WORKSPACE_ID,
    workspaceName: "Workspace público",
    workspaceSlug: "public",
    role: "OWNER",
  };
}
