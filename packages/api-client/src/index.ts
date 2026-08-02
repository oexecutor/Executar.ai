import type { CurrentPosition, ProjectSummary, QrResolution } from '@executa/domain';

export interface ApiErrorBody {
  error: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody
  ) {
    super(body.message ?? body.error);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
}

export class ExecutaApiClient {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await this.fetcher(new URL(path, this.options.baseUrl), {
      ...init,
      headers,
      cache: 'no-store'
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(response.status, body ?? { error: 'invalid_response' });
    }
    return body as T;
  }

  listProjects(): Promise<{ projects: ProjectSummary[] }> {
    return this.request('/api/mobile/projects');
  }

  createProject(input: {
    name: string;
    description?: string;
    firstTaskTitle: string;
    steps: [string, string, string];
  }): Promise<{ projectId: string; taskId: string }> {
    return this.request('/api/mobile/projects', { method: 'POST', body: JSON.stringify(input) });
  }

  getPosition(projectId: string): Promise<CurrentPosition> {
    return this.request(`/api/mobile/projects/${encodeURIComponent(projectId)}/position`);
  }

  completeStep(taskId: string, position: 1 | 2 | 3, idempotencyKey: string) {
    return this.request<{ status: 'ok'; taskStatus: string }>(
      `/api/mobile/tasks/${encodeURIComponent(taskId)}/steps/${position}/complete`,
      { method: 'POST', body: JSON.stringify({ idempotencyKey }) }
    );
  }

  resolveQr(token: string): Promise<QrResolution> {
    return this.request(`/api/mobile/qr/${encodeURIComponent(token)}`);
  }

  confirmQr(token: string, idempotencyKey: string) {
    return this.request<{ status: 'ok'; taskId: string; taskStatus: string }>(
      '/api/mobile/actions/confirm',
      { method: 'POST', body: JSON.stringify({ token, idempotencyKey }) }
    );
  }

  addEvidence(taskId: string, input: Record<string, unknown>) {
    return this.request<{ id: string }>(`/api/mobile/tasks/${encodeURIComponent(taskId)}/evidence`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
}
