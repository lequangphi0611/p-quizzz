// Session time limit (PRODUCT.md §7.27): one clock for the whole session, started by the mentor's "Bắt đầu".
// Pure: shared by the server (deadline checks) and the web (countdown, labels).

import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from './exam-format/index.js';

export const MIN_TIME_LIMIT_MINUTES = MIN_DURATION_MINUTES;
export const MAX_TIME_LIMIT_MINUTES = MAX_DURATION_MINUTES;
/** Most the mentor may add in one go while the session runs. */
export const MAX_EXTEND_MINUTES = 60;
/**
 * After the deadline the server still accepts saves and submits for this long, so the last keystrokes of an essay
 * (debounced on the client) and a submit pressed at 00:00 still land. Then the session closes.
 */
export const TIME_UP_GRACE_MS = 5_000;

/**
 * What every client is told about the clock. `endsAt` is null until the session starts. `remainingMs` is computed
 * by the server when it answers, so a member whose device clock is wrong still counts down correctly.
 */
export interface SessionTimer {
  limitMinutes: number;
  endsAt: number | null; // epoch ms
  remainingMs: number | null; // ms left when the server answered (0 once time is up); null before the start
}

export const deadlineFrom = (startedAt: Date, limitMinutes: number): Date => new Date(startedAt.getTime() + limitMinutes * 60_000);

export function timerOf(limitMinutes: number | null, endsAt: Date | null, now: Date): SessionTimer | null {
  if (limitMinutes === null) return null;
  return { limitMinutes, endsAt: endsAt?.getTime() ?? null, remainingMs: endsAt ? Math.max(0, endsAt.getTime() - now.getTime()) : null };
}

/** True once the deadline plus the grace period has passed: no more saving or submitting, the session must close. */
export const isPastGrace = (endsAt: Date | null, now: Date): boolean => endsAt !== null && now.getTime() >= endsAt.getTime() + TIME_UP_GRACE_MS;

/** "+N phút": the new deadline. Adding after the deadline has passed counts from now, so the minutes are real. */
export const extendedDeadline = (endsAt: Date, minutes: number, now: Date): Date =>
  new Date(Math.max(endsAt.getTime(), now.getTime()) + minutes * 60_000);
