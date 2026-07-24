import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface RuntimeConfig {
  url: string;
  publishableKey: string;
}

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}

interface AppSession {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceMembership["role"];
}

interface AuthEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { message?: string };
}

const WORKSPACE_KEY = "executa.workspace";
let clientPromise: Promise<SupabaseClient> | null = null;

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as AuthEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Serviço de autenticação indisponível.");
  }
  return payload.data;
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  clientPromise ??= request<RuntimeConfig>("/api/auth/config")
    .then(({ url, publishableKey }) => createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }));
  return clientPromise;
}

export async function signIn(email: string, password: string) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email: string, password: string, fullName: string) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle(returnTo: string): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/entrar?return_to=${encodeURIComponent(returnTo)}` },
  });
  if (error) throw error;
}

export async function getBrowserSession() {
  try {
    const client = await getSupabaseClient();
    const { data } = await client.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export async function loadMemberships(accessToken: string): Promise<WorkspaceMembership[]> {
  const data = await request<{ memberships: WorkspaceMembership[] }>("/api/auth/workspaces", {
    access_token: accessToken,
  });
  return data.memberships;
}

export async function selectWorkspace(accessToken: string, membership: WorkspaceMembership): Promise<void> {
  await request("/api/auth/session", {
    access_token: accessToken,
    workspace_id: membership.workspaceId,
  });
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(membership));
}

export function selectedWorkspace(): WorkspaceMembership | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw ? JSON.parse(raw) as WorkspaceMembership : null;
  } catch {
    return null;
  }
}

export async function restoreWorkspaceFromAppSession(): Promise<WorkspaceMembership | null> {
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({})) as AuthEnvelope<AppSession>;
    if (!response.ok || !payload.ok || !payload.data) return null;
    const membership: WorkspaceMembership = {
      workspaceId: payload.data.workspaceId,
      workspaceName: payload.data.workspaceName,
      workspaceSlug: "",
      role: payload.data.role,
    };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(membership));
    return membership;
  } catch {
    return null;
  }
}

export async function apiAuthHeaders(): Promise<Record<string, string>> {
  const session = await getBrowserSession();
  const workspace = selectedWorkspace();
  if (!session?.access_token || !workspace) return {};
  return {
    Authorization: `Bearer ${session.access_token}`,
    "X-Workspace-Id": workspace.workspaceId,
  };
}

export async function signOut(): Promise<void> {
  try {
    const client = await getSupabaseClient();
    await client.auth.signOut();
  } finally {
    localStorage.removeItem(WORKSPACE_KEY);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  }
}
