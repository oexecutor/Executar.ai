import type { KvStore } from "./kv-store.js";

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export interface SupabaseUser {
  id: string;
  email: string | null;
}

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceMembership["role"];
  status: string;
  workspaces?: { id?: string; name?: string; slug?: string; status?: string } | null;
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim();
  return url && publishableKey ? { url: url.replace(/\/$/, ""), publishableKey } : null;
}

export function supabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

function bearerHeaders(accessToken: string): HeadersInit {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("SUPABASE_CONFIG_MISSING");
  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function authenticateSupabaseUser(accessToken: string): Promise<SupabaseUser | null> {
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: bearerHeaders(accessToken),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const body = await response.json() as { id?: unknown; email?: unknown };
  if (typeof body.id !== "string") return null;
  return { id: body.id, email: typeof body.email === "string" ? body.email : null };
}

export async function listWorkspaceMemberships(accessToken: string, userId: string): Promise<WorkspaceMembership[]> {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("SUPABASE_CONFIG_MISSING");
  const url = new URL(`${config.url}/rest/v1/workspace_memberships`);
  url.searchParams.set("select", "workspace_id,role,status,workspaces(id,name,slug,status)");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("status", "eq.ACTIVE");
  const response = await fetch(url, {
    headers: bearerHeaders(accessToken),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`SUPABASE_MEMBERSHIP_LOOKUP_FAILED:${response.status}`);
  const rows = await response.json() as MembershipRow[];
  return rows
    .filter((row) => row.workspaces?.status !== "ARCHIVED" && row.workspaces?.status !== "SUSPENDED")
    .map((row) => ({
      workspaceId: row.workspace_id,
      workspaceName: row.workspaces?.name ?? "Workspace",
      workspaceSlug: row.workspaces?.slug ?? row.workspace_id,
      role: row.role,
    }));
}

export async function resolveSupabaseMembership(
  accessToken: string,
  workspaceId: string,
): Promise<{ user: SupabaseUser; membership: WorkspaceMembership } | null> {
  const user = await authenticateSupabaseUser(accessToken);
  if (!user) return null;
  const membership = (await listWorkspaceMemberships(accessToken, user.id))
    .find((candidate) => candidate.workspaceId === workspaceId);
  return membership ? { user, membership } : null;
}

export async function getWorkspaceMembershipAsService(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership | null> {
  const config = getSupabasePublicConfig();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_CONFIG_MISSING");
  const url = new URL(`${config.url}/rest/v1/workspace_memberships`);
  url.searchParams.set("select", "workspace_id,role,status,workspaces(id,name,slug,status)");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("workspace_id", `eq.${workspaceId}`);
  url.searchParams.set("status", "eq.ACTIVE");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`SUPABASE_SERVICE_MEMBERSHIP_LOOKUP_FAILED:${response.status}`);
  const row = (await response.json() as MembershipRow[])[0];
  if (!row || row.workspaces?.status === "ARCHIVED" || row.workspaces?.status === "SUSPENDED") return null;
  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspaces?.name ?? "Workspace",
    workspaceSlug: row.workspaces?.slug ?? row.workspace_id,
    role: row.role,
  };
}

export class SupabaseKvStore implements KvStore {
  constructor(
    private readonly workspaceId: string,
    private readonly namespace: string,
    private readonly accessToken?: string,
  ) {}

  private config() {
    const config = getSupabasePublicConfig();
    if (!config) throw new Error("SUPABASE_CONFIG_MISSING");
    const authorization = this.accessToken ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!authorization) throw new Error("SUPABASE_STORAGE_CREDENTIAL_MISSING");
    return { ...config, authorization };
  }

  private url(filters: Record<string, string> = {}): URL {
    const { url } = this.config();
    const target = new URL(`${url}/rest/v1/kv_store`);
    for (const [name, value] of Object.entries(filters)) target.searchParams.set(name, value);
    return target;
  }

  private headers(extra: HeadersInit = {}): HeadersInit {
    const { publishableKey, authorization } = this.config();
    return {
      apikey: this.accessToken ? publishableKey : authorization,
      Authorization: `Bearer ${authorization}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async get(key: string): Promise<unknown> {
    const response = await fetch(this.url({
      select: "value",
      workspace_id: `eq.${this.workspaceId}`,
      namespace: `eq.${this.namespace}`,
      key: `eq.${key}`,
      limit: "1",
    }), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SUPABASE_KV_GET_FAILED:${response.status}`);
    const rows = await response.json() as Array<{ value: unknown }>;
    return rows[0]?.value ?? null;
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    const response = await fetch(this.url({ on_conflict: "workspace_id,namespace,key" }), {
      method: "POST",
      headers: this.headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        workspace_id: this.workspaceId,
        namespace: this.namespace,
        key,
        value,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SUPABASE_KV_SET_FAILED:${response.status}`);
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(this.url({
      workspace_id: `eq.${this.workspaceId}`,
      namespace: `eq.${this.namespace}`,
      key: `eq.${key}`,
    }), {
      method: "DELETE",
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SUPABASE_KV_DELETE_FAILED:${response.status}`);
  }

  async list({ prefix }: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }> {
    const response = await fetch(this.url({
      select: "key",
      workspace_id: `eq.${this.workspaceId}`,
      namespace: `eq.${this.namespace}`,
      key: `like.${prefix}*`,
      order: "key.asc",
      limit: "1000",
    }), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SUPABASE_KV_LIST_FAILED:${response.status}`);
    const rows = await response.json() as Array<{ key: string }>;
    return { blobs: rows.map((row) => ({ key: row.key })) };
  }
}
