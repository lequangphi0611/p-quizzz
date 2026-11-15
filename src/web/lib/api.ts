// Thin fetch wrapper. Errors become ApiError with the `{ error }` message from the server.
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const tokenKey = (sessionId: number | string) => `pq-participant-token:${sessionId}`;

// localStorage can throw (private mode, blocked storage) or be missing — never let that break the UI.
export function setParticipantToken(sessionId: number | string, token: string): void {
  try { localStorage.setItem(tokenKey(sessionId), token); } catch { /* ignore */ }
}
export function getParticipantToken(sessionId: number | string): string | null {
  try { return localStorage.getItem(tokenKey(sessionId)); } catch { return null; }
}
export function clearParticipantToken(sessionId: number | string): void {
  try { localStorage.removeItem(tokenKey(sessionId)); } catch { /* ignore */ }
}

// /api/me/* carries no session id in its path, so a member's calls use the session they last joined/resumed.
const CURRENT_KEY = 'pq-current-session';
export function setCurrentSessionId(sessionId: number | string): void {
  try { localStorage.setItem(CURRENT_KEY, String(sessionId)); } catch { /* ignore */ }
}
export function getCurrentSessionId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}

// Member endpoints live under /api/sessions/:id/…; attach that session's token when we have one.
const SESSION_PATH = /^\/api\/sessions\/(\d+)(?:\/|$|\?)/;
const ME_PATH = /^\/api\/me(?:\/|$|\?)/;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sessionId = SESSION_PATH.exec(path)?.[1] ?? (ME_PATH.test(path) ? getCurrentSessionId() : null);
  const token = sessionId ? getParticipantToken(sessionId) : null;
  if (token) headers['X-Participant-Token'] = token;

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
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

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
