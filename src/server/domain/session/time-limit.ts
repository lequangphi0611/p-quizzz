import { extendedDeadline, isPastGrace, timerOf, type SessionTimer } from '../../../shared/session-timer.js';
import { CannotExtendTimeError, TimeLimitLockedError, TimeUpError } from './errors.js';
import type { Session, SessionPatch } from './session.js';

type Timed = Pick<Session, 'status' | 'endsAt'>;

/** PRODUCT.md §7.27c: the limit may be changed, turned on or off only before the session starts. */
export function planSetTimeLimit(s: Pick<Session, 'status'>, timeLimitMinutes: number | null): SessionPatch {
  if (s.status !== 'draft' && s.status !== 'lobby') throw new TimeLimitLockedError();
  return { timeLimitMinutes };
}

/**
 * PRODUCT.md §7.27e: while running, only "+N phút" for everyone. Never shorter, never off.
 * `timeLimitMinutes` stays the sum of the minutes granted (what the mentor reads as "Tổng N phút"). When time is added
 * after 00:00 the new deadline counts from now, so the real total can exceed that sum, but only by the seconds between
 * 00:00 and the press: at most TIME_UP_GRACE_MS, since the session closes after that.
 */
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

/**
 * Whether the session ended because its clock ran out rather than the mentor pressing "Đóng" early: it closed at or
 * after the deadline. Decided from the server's own timestamps, so the member's banner never guesses from a device clock.
 */
export const closedByTimer = (s: Pick<Session, 'closedAt' | 'endsAt'>): boolean =>
  s.closedAt !== null && s.endsAt !== null && s.closedAt.getTime() >= s.endsAt.getTime();
