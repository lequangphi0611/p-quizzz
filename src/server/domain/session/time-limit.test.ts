import { describe, expect, it } from 'vitest';
import { TIME_UP_GRACE_MS } from '../../../shared/session-timer.js';
import { CannotExtendTimeError, TimeLimitLockedError, TimeUpError } from './errors.js';
import { planStart } from './lifecycle.js';
import { assertNotTimeUp, closedByTimer, isExpired, planExtendTime, planSetTimeLimit, sessionTimer } from './time-limit.js';

const MIN = 60_000;
const at = (ms: number) => new Date(ms);

describe('time limit (PRODUCT.md §7.27)', () => {
  it('start sets the shared deadline only when there is a limit', () => {
    expect(planStart(at(1000), 30)).toEqual({ status: 'running', startedAt: at(1000), endsAt: at(1000 + 30 * MIN) });
    expect(planStart(at(1000), null)).toEqual({ status: 'running', startedAt: at(1000) });
  });

  it('the limit can change, appear or go away only before the start', () => {
    expect(planSetTimeLimit({ status: 'draft' }, 20)).toEqual({ timeLimitMinutes: 20 });
    expect(planSetTimeLimit({ status: 'lobby' }, null)).toEqual({ timeLimitMinutes: null });
    for (const status of ['running', 'closed', 'finalized'] as const) expect(() => planSetTimeLimit({ status }, 20)).toThrow(TimeLimitLockedError);
  });

  it('"+N phút" pushes the deadline back while running; after the deadline it counts from now', () => {
    const s = { status: 'running' as const, endsAt: at(10 * MIN), timeLimitMinutes: 10 };
    expect(planExtendTime(s, 5, at(MIN))).toEqual({ endsAt: at(15 * MIN), timeLimitMinutes: 15 });
    expect(planExtendTime(s, 5, at(10 * MIN + 2000))).toEqual({ endsAt: at(15 * MIN + 2000), timeLimitMinutes: 15 });
  });

  it('cannot add time without a limit or outside RUNNING', () => {
    expect(() => planExtendTime({ status: 'running', endsAt: null, timeLimitMinutes: null }, 5, at(0))).toThrow(CannotExtendTimeError);
    expect(() => planExtendTime({ status: 'lobby', endsAt: null, timeLimitMinutes: 10 }, 5, at(0))).toThrow(CannotExtendTimeError);
  });

  it('saving still works during the grace period, not after; the session expires at the same moment', () => {
    const s = { status: 'running' as const, endsAt: at(MIN) };
    expect(() => assertNotTimeUp(s, at(MIN + TIME_UP_GRACE_MS - 1))).not.toThrow();
    expect(isExpired(s, at(MIN + TIME_UP_GRACE_MS - 1))).toBe(false);
    expect(() => assertNotTimeUp(s, at(MIN + TIME_UP_GRACE_MS))).toThrow(TimeUpError);
    expect(isExpired(s, at(MIN + TIME_UP_GRACE_MS))).toBe(true);
    expect(() => assertNotTimeUp({ endsAt: null }, at(Number.MAX_SAFE_INTEGER))).not.toThrow();
    expect(isExpired({ status: 'closed', endsAt: at(0) }, at(MIN))).toBe(false);
  });

  it('clients get the minutes before the start, the countdown while running, nothing once ended', () => {
    expect(sessionTimer({ status: 'lobby', timeLimitMinutes: 30, endsAt: null }, at(0))).toEqual({ limitMinutes: 30, endsAt: null, remainingMs: null });
    expect(sessionTimer({ status: 'running', timeLimitMinutes: 30, endsAt: at(30 * MIN) }, at(MIN))).toEqual({ limitMinutes: 30, endsAt: 30 * MIN, remainingMs: 29 * MIN });
    expect(sessionTimer({ status: 'running', timeLimitMinutes: 30, endsAt: at(30 * MIN) }, at(31 * MIN))?.remainingMs).toBe(0);
    expect(sessionTimer({ status: 'closed', timeLimitMinutes: 30, endsAt: at(30 * MIN) }, at(MIN))).toBeNull();
    expect(sessionTimer({ status: 'running', timeLimitMinutes: null, endsAt: null }, at(MIN))).toBeNull();
  });

  it('a session closed at or after its deadline ended by the timer; an earlier close was the mentor', () => {
    expect(closedByTimer({ endsAt: at(30 * MIN), closedAt: at(30 * MIN + TIME_UP_GRACE_MS) })).toBe(true);
    expect(closedByTimer({ endsAt: at(30 * MIN), closedAt: at(30 * MIN) })).toBe(true);
    expect(closedByTimer({ endsAt: at(30 * MIN), closedAt: at(30 * MIN - 1500) })).toBe(false);
    expect(closedByTimer({ endsAt: null, closedAt: at(MIN) })).toBe(false);
    expect(closedByTimer({ endsAt: at(30 * MIN), closedAt: null })).toBe(false);
  });
});
