import { MAX_READY_MIN, START_COUNTDOWN_MS, START_LATE_TOLERANCE_MS, effectiveStartAt, startInfoOf, type SessionStartInfo } from '../../../shared/session-start.js';
import { NoCountdownError, StartSettingsLockedError, StartTimeInPastError } from './errors.js';
import { assertTransition } from './lifecycle.js';
import type { Session, SessionPatch } from './session.js';

// How a session starts (PRODUCT.md §7.31). Pure: use cases load the facts and apply the returned patch.

type StartState = Pick<Session, 'status' | 'scheduledStartAt' | 'countdownEndsAt' | 'countdownSource' | 'autoStartReady' | 'readyMin'>;

/** Who is in the lobby: approved people (disconnected ones too), how many of them are ready, how many wait for approval. */
export interface Headcount {
  total: number;
  ready: number;
  pending: number;
}

function assertBeforeStart(s: Pick<Session, 'status'>): void {
  if (s.status !== 'draft' && s.status !== 'lobby') throw new StartSettingsLockedError();
}

/** Set, move or remove the scheduled start (§7.31b). The time must lie ahead: a past one would start at once. */
export function planSchedule(s: Pick<Session, 'status'>, at: Date | null, now: Date): SessionPatch {
  assertBeforeStart(s);
  if (at && at.getTime() <= now.getTime()) throw new StartTimeInPastError();
  return { scheduledStartAt: at, startScheduleDroppedAt: null };
}

/** "Bắt đầu ngay": a 10-second countdown for the whole room (§7.31c). Pressing it again while one runs changes nothing. */
export function planStartCountdown(s: StartState, now: Date): SessionPatch {
  assertTransition(s, 'start');
  if (s.countdownEndsAt) return {};
  return { countdownEndsAt: new Date(now.getTime() + START_COUNTDOWN_MS), countdownSource: 'now' };
}

/**
 * Only the mentor cancels a countdown (§7.31c). It also turns "everyone ready" off: everyone is still ready, so the
 * countdown would otherwise start again at once and could never be cancelled. Ready marks are kept.
 */
export function planCancelCountdown(s: StartState): SessionPatch {
  if (s.status !== 'lobby' || !s.countdownEndsAt) throw new NoCountdownError();
  return { countdownEndsAt: null, countdownSource: null, autoStartReady: false };
}

/** "Tự bắt đầu khi mọi người sẵn sàng", at least `readyMin` people (§7.31e). */
export function planAutoStart(s: Pick<Session, 'status'>, enabled: boolean, readyMin: number): SessionPatch {
  assertBeforeStart(s);
  return { autoStartReady: enabled, readyMin: Math.min(MAX_READY_MIN, Math.max(1, Math.trunc(readyMin))) };
}

export const startsAt = (s: Pick<Session, 'scheduledStartAt' | 'countdownEndsAt'>): Date | null => effectiveStartAt(s.scheduledStartAt, s.countdownEndsAt);

const lateBy = (at: Date | null, now: Date): number | null => (at ? now.getTime() - at.getTime() : null);

/**
 * A start that passed too long ago (§7.31b): the server was off or asleep then. It is dropped, never acted on.
 * Checked per clock, so a stale schedule does not hide a countdown that is still fine, and the other way round.
 */
export function isStartOverdue(s: StartState, now: Date): boolean {
  if (s.status !== 'lobby') return false;
  return [s.scheduledStartAt, s.countdownEndsAt].some(at => (lateBy(at, now) ?? -1) > START_LATE_TOLERANCE_MS);
}

/** The session should start now: its start time has come, and not so long ago that it must be dropped instead. */
export function isStartDue(s: StartState, now: Date): boolean {
  if (s.status !== 'lobby' || isStartOverdue(s, now)) return false;
  const at = startsAt(s);
  return !!at && at.getTime() <= now.getTime();
}

/** Clears what is overdue. A dropped schedule is remembered so the mentor's bell can say so; a dropped countdown is not. */
export function planDropOverdue(s: StartState, now: Date): SessionPatch {
  const patch: SessionPatch = {};
  if ((lateBy(s.scheduledStartAt, now) ?? -1) > START_LATE_TOLERANCE_MS) Object.assign(patch, { scheduledStartAt: null, startScheduleDroppedAt: now });
  if ((lateBy(s.countdownEndsAt, now) ?? -1) > START_LATE_TOLERANCE_MS) Object.assign(patch, { countdownEndsAt: null, countdownSource: null });
  return patch;
}

/**
 * "Everyone ready" (§7.31e): only when the mentor turned it on, with at least `readyMin` approved people in the room,
 * all of them ready, and nobody left waiting for approval (they would be left behind). Not while a countdown runs.
 */
export function readyToAutoStart(s: StartState, h: Headcount): boolean {
  return s.status === 'lobby' && s.autoStartReady && !s.countdownEndsAt && h.total > 0 && h.total >= (s.readyMin ?? 1) && h.ready === h.total && h.pending === 0;
}

export const planReadyCountdown = (now: Date): SessionPatch => ({ countdownEndsAt: new Date(now.getTime() + START_COUNTDOWN_MS), countdownSource: 'ready' });

/** What clients are told about the start; nothing once the session has started (the start no longer matters). */
export function sessionStartInfo(s: StartState, ready: { count: number; total: number }, now: Date): SessionStartInfo | null {
  if (s.status !== 'draft' && s.status !== 'lobby') return null;
  return startInfoOf(s, ready, now);
}
