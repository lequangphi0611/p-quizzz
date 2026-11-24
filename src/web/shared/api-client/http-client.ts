// Core HTTP client: request, JSON parsing, ApiError. It knows nothing about tokens or auth; cross-cutting
// headers are added by interceptors (see participant-auth.ts) that the composition root passes in.

/** Errors become ApiError carrying the `{ error }` message from the server (status 0 = network failure). */
export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable reason the server may add (e.g. `identity_in_use`); the web acts on it, the user reads `message`. */
  readonly code: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface OutgoingRequest {
  method: string;
  path: string;
  /** Mutable: an interceptor adds its headers here. */
  headers: Record<string, string>;
}
export type RequestInterceptor = (request: OutgoingRequest) => void;

/** Per-call extras. `headers` are added after the interceptors (a call that carries its own credential, e.g. a training member token). */
export interface RequestOptions {
  headers?: Record<string, string>;
  /** `text`: a successful answer is returned as the raw body, not parsed as JSON (a Markdown file); `blob`: as a `Blob` (a zip). Errors are still `{ error }` JSON. */
  as?: 'json' | 'text' | 'blob';
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
}

export interface HttpClientOptions {
  interceptors?: RequestInterceptor[];
  /** Defaults to the global `fetch`, looked up per call (so tests can stub it). */
  fetch?: typeof fetch;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const interceptors = options.interceptors ?? [];
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const outgoing: OutgoingRequest = { method, path, headers: {} };
    if (body !== undefined) outgoing.headers['Content-Type'] = 'application/json';
    for (const intercept of interceptors) intercept(outgoing);
    if (options?.headers) Object.assign(outgoing.headers, options.headers);

    let res: Response;
    try {
      res = await doFetch(path, { method, headers: outgoing.headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'Không kết nối được tới máy chủ');
    }

    if (res.ok && options?.as === 'blob') return (await res.blob()) as T;
    const text = await res.text();
    if (res.ok && options?.as === 'text') return text as T;
    let data: unknown;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    if (!res.ok) {
      const msg = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Lỗi ${res.status}`;
      const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : undefined;
      throw new ApiError(res.status, msg, code);
    }
    return data as T;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
    delete: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),
  };
}
