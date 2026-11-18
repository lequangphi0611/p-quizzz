import type { MySessionsStore } from '../application/member-gateway.js';
import { parseMySessions, type MySession } from '../domain/my-sessions.js';

const KEY = 'pq-my-sessions';

/** "Phiên của bạn trên máy này" (PRODUCT.md §7.29), in localStorage so it outlives the tab. Broken storage reads as empty. */
export class LocalStorageMySessionsStore implements MySessionsStore {
  load(): MySession[] {
    try { const raw = localStorage.getItem(KEY); return raw ? parseMySessions(JSON.parse(raw)) : []; } catch { return []; }
  }
  save(list: MySession[]): void {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }
}
