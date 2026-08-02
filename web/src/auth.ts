import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeConfig =
  | {
      mode: "public";
      workspaceId: string;
      workspaceName: string;
    }
  | {
      mode: "supabase";
      url: string;
      publishableKey: string;
    };

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
let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;
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

function getRuntimeConfig(): Promise<RuntimeConfig> {
  runtimeConfigPromise ??= request<RuntimeConfig>("/api/auth/config");
  return runtimeConfigPromise;
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  clientPromise ??= getRuntimeConfig().then((config) => {
    if (config.mode !== "supabase") {
      throw new Error("Autenticação Supabase desativada no modo de workspace público.");
    }
    return createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  });
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

export async function signInWithGoogle(): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/app` },
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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function loadProvisionedMemberships(accessToken: string): Promise<WorkspaceMembership[]> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const memberships = await loadMemberships(accessToken);
    if (memberships.length) return memberships;
    await wait(250 * (attempt + 1));
  }
  return [];
}

/**
 * Opens the product without exposing a login screen. A Supabase anonymous
 * account is still created behind the scenes so every visitor receives an
 * isolated workspace protected by the existing JWT + RLS rules.
 */
export async function ensureWorkspaceSession(): Promise<WorkspaceMembership> {
  const appWorkspace = await restoreWorkspaceFromAppSession();
  if (appWorkspace) return appWorkspace;

  const config = await getRuntimeConfig();
  if (config.mode === "public") {
    const membership: WorkspaceMembership = {
      workspaceId: config.workspaceId,
      workspaceName: config.workspaceName,
      workspaceSlug: "public",
      role: "OWNER",
    };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(membership));
    return membership;
  }

  const client = await getSupabaseClient();
  let { data: { session } } = await client.auth.getSession();

  if (!session) {
    const { data, error } = await client.auth.signInAnonymously({
      options: { data: { full_name: "Meu workspace EXECUTA" } },
    });
    if (error) {
      throw new Error("Não foi possível criar sua sessão gratuita. Tente novamente.");
    }
    session = data.session;
  }

  if (!session?.access_token) {
    throw new Error("A sessão gratuita não foi iniciada corretamente.");
  }

  const memberships = await loadProvisionedMemberships(session.access_token);
  if (!memberships.length) {
    throw new Error("Seu workspace ainda não ficou pronto. Tente novamente em alguns segundos.");
  }

  const previous = selectedWorkspace();
  const membership = memberships.find((candidate) => candidate.workspaceId === previous?.workspaceId)
    ?? memberships[0];
  await selectWorkspace(session.access_token, membership);
  return membership;
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
