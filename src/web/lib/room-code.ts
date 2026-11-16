import { normalizeRoomCode, ROOM_CODE_LENGTH } from '../../shared/api/index.js';

/** Digits only, at most 6 — what the input keeps while someone types or pastes "482 913". */
export const cleanRoomCode = (raw: string): string => normalizeRoomCode(raw).slice(0, ROOM_CODE_LENGTH);

/** "482913" → "482 913": easier to read aloud and off a projector. */
export const formatRoomCode = (code: string): string => (code.length === ROOM_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

/** The code from a join link such as `/?room=482913` (empty when absent or malformed). */
export function roomFromSearch(search: string): string {
  const code = cleanRoomCode(new URLSearchParams(search).get('room') ?? '');
  return code.length === ROOM_CODE_LENGTH ? code : '';
}

/** The link the mentor sends: opens the member page with the code already filled in. */
export const joinLink = (host: string, code: string): string => `http://${host}/?room=${code}`;

const storageKey = (sessionId: number) => `pq-room-code:${sessionId}`;
// Remembered per session so "join again with another name" after a kick does not need the code retyped.
export function rememberRoomCode(sessionId: number, code: string): void {
  try { sessionStorage.setItem(storageKey(sessionId), code); } catch { /* ignore */ }
}
export function recallRoomCode(sessionId: number): string {
  try { return sessionStorage.getItem(storageKey(sessionId)) ?? ''; } catch { return ''; }
}
