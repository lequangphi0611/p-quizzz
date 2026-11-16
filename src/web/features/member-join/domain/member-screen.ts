import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';

// Result of the latest GET /api/me for the session being followed. `replaced`: the mentor let this person back in from
// another device (PRODUCT.md §7.23), so this one has stopped.
export type MeState = 'idle' | 'ok' | 'kicked' | 'replaced' | 'error';

/** Where a "let me back in" request stands, from this browser's side. `pending` also covers "asked, waiting for the mentor". */
export type RejoinState = 'pending' | 'rejected' | 'expired';

/** `code` = ask for the room code (nothing found yet); `join` = the code found a session, ask for the name. */
export type MemberScreen = 'loading' | 'code' | 'join' | 'rejoin' | 'replaced' | 'pending' | 'lobby' | 'running' | 'ended' | 'kicked' | 'error';

export interface ScreenInput {
  /** The session this browser holds a token for and follows; null when it is not in any session. */
  followId: number | null;
  /** The open session the typed (or linked) room code found; null until one is found. */
  room: ActiveSession | null;
  me: MeResponse | null;
  meState: MeState;
  /** A request to be let back in, while this browser has one (it shows instead of the session). */
  rejoin?: RejoinState | null;
}

// Which member screen to show at "/" (S10, S20, S22). Pure so every combination is testable.
export function decideScreen({ followId, room, me, meState, rejoin = null }: ScreenInput): MemberScreen {
  if (followId === null) return room ? 'join' : 'code';
  if (rejoin !== null) return 'rejoin';
  if (meState === 'replaced') return 'replaced';
  if (meState === 'kicked') return 'kicked';
  // `me` may still describe another session while this one loads.
  if (!me || me.session.id !== followId) return meState === 'error' ? 'error' : 'loading';
  if (me.participant.status === 'kicked') return 'kicked';
  if (me.session.status !== 'lobby' && me.session.status !== 'running') return 'ended';
  if (me.participant.status === 'pending') return 'pending';
  return me.session.status === 'lobby' ? 'lobby' : 'running';
}
