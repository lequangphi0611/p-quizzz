import type { ActiveSession, MeResponse } from '../../shared/api/index.js';

// Result of the latest GET /api/me for the active session.
export type MeState = 'idle' | 'ok' | 'kicked' | 'error';

export type MemberScreen = 'loading' | 'none' | 'join' | 'pending' | 'lobby' | 'running' | 'ended' | 'kicked' | 'error';

export interface ScreenInput {
  /** `undefined` while the first /api/sessions/active call is in flight; `null` when nothing is active. */
  active: ActiveSession | null | undefined;
  hasToken: boolean;
  me: MeResponse | null;
  meState: MeState;
}

// Which member screen to show at "/" (S10). Pure so every combination is testable.
export function decideScreen({ active, hasToken, me, meState }: ScreenInput): MemberScreen {
  if (active === undefined) return 'loading';
  if (active === null) return 'none';
  if (!hasToken) return 'join';
  if (meState === 'kicked') return 'kicked';
  // `me` may still describe a previous session while the new one loads.
  if (!me || me.session.id !== active.id) return meState === 'error' ? 'error' : 'loading';
  if (me.participant.status === 'kicked') return 'kicked';
  if (me.session.status !== 'lobby' && me.session.status !== 'running') return 'ended';
  if (me.participant.status === 'pending') return 'pending';
  return me.session.status === 'lobby' ? 'lobby' : 'running';
}
