/**
 * Where the member's participant tokens live: one token per session, plus the "current" session that
 * `/api/me/*` calls act for (those paths carry no session id). Implementations must never throw.
 */
export interface TokenStore {
  getToken(sessionId: number | string): string | null;
  setToken(sessionId: number | string, token: string): void;
  clearToken(sessionId: number | string): void;
  /** The session this tab acts for. Per tab, so two tabs in two parallel sessions never swap each other's token. */
  getCurrentSessionId(): string | null;
  setCurrentSessionId(sessionId: number | string): void;
  /** Forget which session this tab was following (the tokens stay). */
  clearCurrentSessionId(): void;
}
