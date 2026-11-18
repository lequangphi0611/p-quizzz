import type { SessionStatus } from '../../../../shared/session-state.js';

/**
 * A session this browser joined (PRODUCT.md §7.29, "Phiên của bạn trên máy này"). Only what the member already saw:
 * the exam title (never the mentor's session name), the room code they typed, when they joined, the last known status.
 */
export interface MySession {
  sessionId: number;
  /** '' when not known (e.g. a session joined before this list existed). */
  roomCode: string;
  title: string;
  /** Epoch ms of the first time this browser joined the session. */
  joinedAt: number;
  status: SessionStatus | null;
}

/** How many sessions are kept in storage, and how many the code screen lists. */
export const MY_SESSIONS_KEPT = 30;
export const MY_SESSIONS_SHOWN = 10;

/**
 * Adds the session, or updates what changed (title, status, a code that was missing). `joinedAt` and a known code
 * never change. Newest first; the oldest fall off past `MY_SESSIONS_KEPT`.
 */
export function rememberMySession(list: readonly MySession[], entry: Partial<MySession> & { sessionId: number }, now: number): MySession[] {
  const old = list.find(s => s.sessionId === entry.sessionId);
  const next: MySession = {
    sessionId: entry.sessionId,
    roomCode: old?.roomCode || entry.roomCode || '',
    title: entry.title || old?.title || '',
    joinedAt: old?.joinedAt ?? entry.joinedAt ?? now,
    status: entry.status ?? old?.status ?? null,
  };
  if (old && old.roomCode === next.roomCode && old.title === next.title && old.status === next.status) return list as MySession[];
  return [next, ...list.filter(s => s.sessionId !== entry.sessionId)].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, MY_SESSIONS_KEPT);
}

export function forgetMySession(list: readonly MySession[], sessionId: number): MySession[] {
  return list.some(s => s.sessionId === sessionId) ? list.filter(s => s.sessionId !== sessionId) : (list as MySession[]);
}

/** The remembered session a room code belongs to, if any (codes are unique across sessions, PRODUCT.md §7.16). */
export function findMySessionByCode(list: readonly MySession[], roomCode: string): MySession | null {
  if (!roomCode) return null;
  return list.find(s => s.roomCode === roomCode) ?? null;
}

/** What the code screen lists: newest first, at most `MY_SESSIONS_SHOWN`. */
export function recentMySessions(list: readonly MySession[], limit = MY_SESSIONS_SHOWN): MySession[] {
  return [...list].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, limit);
}

/** Reads stored data defensively: anything malformed is dropped, never thrown. */
export function parseMySessions(raw: unknown): MySession[] {
  if (!Array.isArray(raw)) return [];
  const statuses: readonly string[] = ['draft', 'lobby', 'running', 'closed', 'finalized'];
  const out: MySession[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.sessionId !== 'number' || !Number.isInteger(o.sessionId) || o.sessionId <= 0) continue;
    out.push({
      sessionId: o.sessionId,
      roomCode: typeof o.roomCode === 'string' && /^\d{6}$/.test(o.roomCode) ? o.roomCode : '',
      title: typeof o.title === 'string' ? o.title.slice(0, 300) : '',
      joinedAt: typeof o.joinedAt === 'number' && Number.isFinite(o.joinedAt) ? o.joinedAt : 0,
      status: typeof o.status === 'string' && statuses.includes(o.status) ? (o.status as SessionStatus) : null,
    });
  }
  return out;
}
