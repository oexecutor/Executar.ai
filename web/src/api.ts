import { apiAuthHeaders } from "./auth";

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
  const authHeaders = await apiAuthHeaders();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders, ...init.headers },
  });
  if (response.status === 401) throw new UnauthorizedError();
  const body = await response.json().catch(() => ({})) as Partial<Envelope<T>>;
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

export function deleteJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "DELETE", body: JSON.stringify(body) });
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
