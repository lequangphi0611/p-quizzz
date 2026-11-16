import type { SeenStore } from '../application/mentor-notices-gateway.js';

const seenKey = (sessionId: number) => `pq:mentor:notices-seen:${sessionId}`;

/** Storage can throw (private mode): never break the UI. */
export class LocalStorageSeenStore implements SeenStore {
  load(sessionId: number): number { try { return Number(localStorage.getItem(seenKey(sessionId))) || 0; } catch { return 0; } }
  save(sessionId: number, at: number): void { try { localStorage.setItem(seenKey(sessionId), String(at)); } catch { /* ignore */ } }
}
