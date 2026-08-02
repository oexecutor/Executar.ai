export interface AuthIdentity {
  userId: string;
  email?: string;
  expiresAt?: number;
}

export interface AuthState {
  identity: AuthIdentity | null;
  loading: boolean;
}

export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
