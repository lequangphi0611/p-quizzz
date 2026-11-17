import type { TokenStore } from './token-store.js';

const tokenKey = (sessionId: number | string) => `pq:participant:${sessionId}`;
const CURRENT_KEY = 'pq-current-session';

/**
 * Backed by `localStorage`, looked up on every call. It can throw (private mode, blocked storage) or be
 * missing: never let that break the UI, so failures read as "no token" and writes are dropped.
 */
export class LocalStorageTokenStore implements TokenStore {
  getToken(sessionId: number | string): string | null {
    try { return localStorage.getItem(tokenKey(sessionId)); } catch { return null; }
  }
  setToken(sessionId: number | string, token: string): void {
    try { localStorage.setItem(tokenKey(sessionId), token); } catch { /* ignore */ }
  }
  clearToken(sessionId: number | string): void {
    try { localStorage.removeItem(tokenKey(sessionId)); } catch { /* ignore */ }
  }
  // The "current session" is per TAB (sessionStorage), because several sessions may run at once and each tab follows its own.
  // localStorage keeps the last one only so a NEW tab can resume where the member was.
  getCurrentSessionId(): string | null {
    try { const own = sessionStorage.getItem(CURRENT_KEY); if (own) return own; } catch { /* fall through */ }
    try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
  }
  setCurrentSessionId(sessionId: number | string): void {
    try { sessionStorage.setItem(CURRENT_KEY, String(sessionId)); } catch { /* ignore */ }
    try { localStorage.setItem(CURRENT_KEY, String(sessionId)); } catch { /* ignore */ }
  }
  clearCurrentSessionId(): void {
    try { sessionStorage.removeItem(CURRENT_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(CURRENT_KEY); } catch { /* ignore */ }
  }
}
