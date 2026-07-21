export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super("UNAUTHORIZED", "Sessão expirada ou não autenticada.", 401);
  }
}

interface Envelope<T> {
  ok: boolean;
  data: T;
  warnings: string[];
  request_id: string;
  error?: { code: string; message: string; suggestion?: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 401) throw new UnauthorizedError();
  const body = (await response.json().catch(() => ({}))) as Partial<Envelope<T>>;
  if (!response.ok || body.ok === false) {
    throw new ApiError(
      body.error?.code ?? "REQUEST_ERROR",
      body.error?.message ?? `Erro ${response.status}`,
      response.status,
    );
  }
  return body.data as T;
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function login(password: string): Promise<void> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ApiError("LOGIN_FAILED", body.error?.message ?? "Senha inválida.", response.status);
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" });
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
