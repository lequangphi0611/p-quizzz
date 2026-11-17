import { extendedDeadline, isPastGrace, timerOf, type SessionTimer } from '../../../shared/session-timer.js';
import { CannotExtendTimeError, TimeLimitLockedError, TimeUpError } from './errors.js';
import type { Session, SessionPatch } from './session.js';

type Timed = Pick<Session, 'status' | 'endsAt'>;

/** PRODUCT.md §7.27c: the limit may be changed, turned on or off only before the session starts. */
export function planSetTimeLimit(s: Pick<Session, 'status'>, timeLimitMinutes: number | null): SessionPatch {
  if (s.status !== 'draft' && s.status !== 'lobby') throw new TimeLimitLockedError();
  return { timeLimitMinutes };
}

/** PRODUCT.md §7.27e: while running, only "+N phút" for everyone. Never shorter, never off. */
export function planExtendTime(s: Timed & Pick<Session, 'timeLimitMinutes'>, minutes: number, now: Date): SessionPatch {
  if (s.status !== 'running') throw new CannotExtendTimeError('not_running');
  if (!s.endsAt || s.timeLimitMinutes === null) throw new CannotExtendTimeError('no_limit');
  return { endsAt: extendedDeadline(s.endsAt, minutes, now), timeLimitMinutes: s.timeLimitMinutes + minutes };
}

/** Saving and submitting stop once the deadline and its grace period have passed (the session is about to close). */
export function assertNotTimeUp(s: Pick<Session, 'endsAt'>, now: Date): void {
  if (isPastGrace(s.endsAt, now)) throw new TimeUpError();
}

/** A running session whose clock (plus grace) has run out: it must be closed as if the mentor pressed "Đóng". */
export const isExpired = (s: Timed, now: Date): boolean => s.status === 'running' && isPastGrace(s.endsAt, now);

/** What clients are told about the clock; nothing once the session has ended (the countdown no longer matters). */
export function sessionTimer(s: Pick<Session, 'status' | 'timeLimitMinutes' | 'endsAt'>, now: Date): SessionTimer | null {
  if (s.status === 'closed' || s.status === 'finalized') return null;
  return timerOf(s.timeLimitMinutes, s.endsAt, now);
}
