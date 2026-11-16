import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';

// Result of the latest GET /api/me for the session being followed.
export type MeState = 'idle' | 'ok' | 'kicked' | 'error';

/** `code` = ask for the room code (nothing found yet); `join` = the code found a session, ask for the name. */
export type MemberScreen = 'loading' | 'code' | 'join' | 'pending' | 'lobby' | 'running' | 'ended' | 'kicked' | 'error';

export interface ScreenInput {
  /** The session this browser holds a token for and follows; null when it is not in any session. */
  followId: number | null;
  /** The open session the typed (or linked) room code found; null until one is found. */
  room: ActiveSession | null;
  me: MeResponse | null;
  meState: MeState;
}

// Which member screen to show at "/" (S10, S20). Pure so every combination is testable.
export function decideScreen({ followId, room, me, meState }: ScreenInput): MemberScreen {
  if (followId === null) return room ? 'join' : 'code';
  if (meState === 'kicked') return 'kicked';
  // `me` may still describe another session while this one loads.
  if (!me || me.session.id !== followId) return meState === 'error' ? 'error' : 'loading';
  if (me.participant.status === 'kicked') return 'kicked';
  if (me.session.status !== 'lobby' && me.session.status !== 'running') return 'ended';
  if (me.participant.status === 'pending') return 'pending';
  return me.session.status === 'lobby' ? 'lobby' : 'running';
}
