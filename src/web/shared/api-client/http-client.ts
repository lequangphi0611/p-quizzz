// Core HTTP client: request, JSON parsing, ApiError. It knows nothing about tokens or auth; cross-cutting
// headers are added by interceptors (see participant-auth.ts) that the composition root passes in.

/** Errors become ApiError carrying the `{ error }` message from the server (status 0 = network failure). */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface OutgoingRequest {
  method: string;
  path: string;
  /** Mutable: an interceptor adds its headers here. */
  headers: Record<string, string>;
}
export type RequestInterceptor = (request: OutgoingRequest) => void;

export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string, body?: unknown): Promise<T>;
}

export interface HttpClientOptions {
  interceptors?: RequestInterceptor[];
  /** Defaults to the global `fetch`, looked up per call (so tests can stub it). */
  fetch?: typeof fetch;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const interceptors = options.interceptors ?? [];
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const outgoing: OutgoingRequest = { method, path, headers: {} };
    if (body !== undefined) outgoing.headers['Content-Type'] = 'application/json';
    for (const intercept of interceptors) intercept(outgoing);

    let res: Response;
    try {
      res = await doFetch(path, { method, headers: outgoing.headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'Không kết nối được tới máy chủ');
    }

    const text = await res.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    if (!res.ok) {
      const msg = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Lỗi ${res.status}`;
      throw new ApiError(res.status, msg);
    }
    return data as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  };
}
