import type { TokenStore } from '../token-store/token-store.js';
import type { RequestInterceptor } from './http-client.js';

// Member endpoints live under /api/sessions/:id/…; /api/me/* carries no session id, so it acts for the
// session the member last joined or resumed (TokenStore.getCurrentSessionId).
const SESSION_PATH = /^\/api\/sessions\/(\d+)(?:\/|$|\?)/;
const ME_PATH = /^\/api\/(?:me|rejoin)(?:\/|$|\?)/; // /api/rejoin/*: the asker's request token (S22)

/** Which session's token a request should carry, from the API path convention. Null = anonymous. */
export function sessionIdForPath(path: string, store: Pick<TokenStore, 'getCurrentSessionId'>): string | null {
  return SESSION_PATH.exec(path)?.[1] ?? (ME_PATH.test(path) ? store.getCurrentSessionId() : null);
}

/** Interceptor that attaches `X-Participant-Token` when the store holds a token for the request's session. */
export function participantAuth(store: TokenStore): RequestInterceptor {
  return request => {
    const sessionId = sessionIdForPath(request.path, store);
    const token = sessionId ? store.getToken(sessionId) : null;
    if (token) request.headers['X-Participant-Token'] = token;
  };
}
