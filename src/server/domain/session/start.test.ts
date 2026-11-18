import { describe, expect, it } from 'vitest';
import { START_COUNTDOWN_MS, START_LATE_TOLERANCE_MS } from '../../../shared/session-start.js';
import { InvalidSessionTransitionError, NoCountdownError, StartSettingsLockedError, StartTimeInPastError } from './errors.js';
import {
  isStartDue,
  isStartOverdue,
  planAutoStart,
  planCancelCountdown,
  planDropOverdue,
  planOpenSchedule,
  planSchedule,
  planStartCountdown,
  readyToAutoStart,
  sessionStartInfo,
} from './start.js';

const at = (ms: number) => new Date(ms);
const lobby = (over: Record<string, unknown> = {}) => ({
  status: 'lobby' as const,
  scheduledStartAt: null as Date | null,
  countdownEndsAt: null as Date | null,
  countdownSource: null as 'now' | 'ready' | null,
  autoStartReady: false,
  readyMin: null as number | null,
  ...over,
});

describe('session start (PRODUCT.md §7.31)', () => {
  it('schedules only ahead of now, before the start', () => {
    expect(planSchedule({ status: 'draft' }, at(2000), at(1000))).toEqual({ scheduledStartAt: at(2000), startScheduleDroppedAt: null });
    expect(planSchedule({ status: 'lobby' }, null, at(1000))).toEqual({ scheduledStartAt: null, startScheduleDroppedAt: null });
    expect(() => planSchedule({ status: 'lobby' }, at(1000), at(1000))).toThrow(StartTimeInPastError);
    expect(() => planSchedule({ status: 'running' }, at(5000), at(1000))).toThrow(StartSettingsLockedError);
  });

  it('"Bắt đầu ngay" counts down 10 seconds; pressing again keeps the running countdown', () => {
    expect(planStartCountdown(lobby(), at(1000))).toEqual({ countdownEndsAt: at(1000 + START_COUNTDOWN_MS), countdownSource: 'now' });
    expect(planStartCountdown(lobby({ countdownEndsAt: at(5000) }), at(2000))).toEqual({});
    expect(() => planStartCountdown(lobby({ status: 'draft' }), at(0))).toThrow(InvalidSessionTransitionError);
  });

  it('cancelling the countdown turns "everyone ready" off, so it cannot restart at once', () => {
    expect(planCancelCountdown(lobby({ countdownEndsAt: at(5000), autoStartReady: true }))).toEqual({ countdownEndsAt: null, countdownSource: null, autoStartReady: false });
    expect(() => planCancelCountdown(lobby())).toThrow(NoCountdownError);
  });

  it('auto start keeps the least number of people within bounds', () => {
    expect(planAutoStart({ status: 'lobby' }, true, 0)).toEqual({ autoStartReady: true, readyMin: 1 });
    expect(planAutoStart({ status: 'draft' }, false, 8)).toEqual({ autoStartReady: false, readyMin: 8 });
    expect(() => planAutoStart({ status: 'running' }, true, 3)).toThrow(StartSettingsLockedError);
  });

  it('is due at the earlier of the scheduled time and the countdown, in the lobby only', () => {
    const s = lobby({ scheduledStartAt: at(10_000), countdownEndsAt: at(20_000) });
    expect(isStartDue(s, at(9_999))).toBe(false);
    expect(isStartDue(s, at(10_000))).toBe(true);
    expect(isStartDue(lobby({ countdownEndsAt: at(5000) }), at(5000))).toBe(true);
    expect(isStartDue({ ...s, status: 'running' }, at(10_000))).toBe(false);
    expect(isStartDue(lobby(), at(10_000))).toBe(false);
  });

  it('a start that passed while the server was off is dropped, not acted on (§7.31b)', () => {
    const s = lobby({ scheduledStartAt: at(10_000) });
    const late = at(10_000 + START_LATE_TOLERANCE_MS + 1);
    expect(isStartOverdue(s, at(10_000 + START_LATE_TOLERANCE_MS))).toBe(false);
    expect(isStartOverdue(s, late)).toBe(true);
    expect(isStartDue(s, late)).toBe(false);
    expect(planDropOverdue(s, late)).toEqual({ scheduledStartAt: null, startScheduleDroppedAt: late });
    // A stale countdown is cleared quietly; a fresh schedule next to it is kept.
    expect(planDropOverdue(lobby({ countdownEndsAt: at(0), scheduledStartAt: at(60_000) }), late)).toEqual({ countdownEndsAt: null, countdownSource: null });
  });

  it('everyone ready needs the option, the minimum, all ready, nobody pending and no countdown yet', () => {
    const on = lobby({ autoStartReady: true, readyMin: 3 });
    expect(readyToAutoStart(on, { total: 3, ready: 3, pending: 0 })).toBe(true);
    expect(readyToAutoStart(lobby({ readyMin: 3 }), { total: 3, ready: 3, pending: 0 })).toBe(false); // off
    expect(readyToAutoStart(on, { total: 2, ready: 2, pending: 0 })).toBe(false); // under the minimum
    expect(readyToAutoStart(on, { total: 3, ready: 2, pending: 0 })).toBe(false);
    expect(readyToAutoStart(on, { total: 3, ready: 3, pending: 1 })).toBe(false); // someone at the door
    expect(readyToAutoStart({ ...on, countdownEndsAt: at(1) }, { total: 3, ready: 3, pending: 0 })).toBe(false);
    expect(readyToAutoStart(lobby({ autoStartReady: true, readyMin: 1 }), { total: 0, ready: 0, pending: 0 })).toBe(false);
  });

  it('tells clients the earliest start, the countdown left, and whether it is early', () => {
    const info = sessionStartInfo(lobby({ scheduledStartAt: at(60_000), countdownEndsAt: at(10_000), countdownSource: 'now' }), { count: 2, total: 5 }, at(4_000));
    expect(info).toEqual({
      scheduledAt: 60_000, countdownEndsAt: 10_000, countdownSource: 'now', startsAt: 10_000, startsInMs: 6_000, early: true,
      autoStartReady: false, readyMin: null, ready: { count: 2, total: 5 },
    });
    expect(sessionStartInfo(lobby(), { count: 0, total: 0 }, at(0))).toMatchObject({ startsAt: null, startsInMs: null, early: false });
    expect(sessionStartInfo(lobby({ status: 'running' }), { count: 0, total: 0 }, at(0))).toBeNull();
  });
});

describe('planOpenSchedule', () => {
  it('clears a time that passed while the session was a draft, so opening never starts an empty room', () => {
    expect(planOpenSchedule({ scheduledStartAt: at(-5_000) }, at(0))).toEqual({ scheduledStartAt: null });
    expect(planOpenSchedule({ scheduledStartAt: at(60_000) }, at(0))).toEqual({});
    expect(planOpenSchedule({ scheduledStartAt: null }, at(0))).toEqual({});
  });
});
