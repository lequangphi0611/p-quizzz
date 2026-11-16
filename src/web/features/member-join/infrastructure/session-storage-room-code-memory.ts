import type { RoomCodeMemory } from '../application/member-gateway.js';

const storageKey = (sessionId: number) => `pq-room-code:${sessionId}`;

/** Per-tab memory; storage can throw (private mode), which must never break the UI. */
export class SessionStorageRoomCodeMemory implements RoomCodeMemory {
  remember(sessionId: number, code: string): void { try { sessionStorage.setItem(storageKey(sessionId), code); } catch { /* ignore */ } }
  recall(sessionId: number): string { try { return sessionStorage.getItem(storageKey(sessionId)) ?? ''; } catch { return ''; } }
}
