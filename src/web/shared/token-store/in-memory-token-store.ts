import type { TokenStore } from './token-store.js';

/** Test double: same contract as `LocalStorageTokenStore`, no browser. */
export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, string>();
  private current: string | null = null;

  getToken(sessionId: number | string): string | null { return this.tokens.get(String(sessionId)) ?? null; }
  setToken(sessionId: number | string, token: string): void { this.tokens.set(String(sessionId), token); }
  clearToken(sessionId: number | string): void { this.tokens.delete(String(sessionId)); }
  getCurrentSessionId(): string | null { return this.current; }
  setCurrentSessionId(sessionId: number | string): void { this.current = String(sessionId); }
  clearCurrentSessionId(): void { this.current = null; }
}
