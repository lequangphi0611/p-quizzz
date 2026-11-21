import { describe, expect, it } from 'vitest';
import { CHECK_WAIT_MS, FAST_POLL_MS, SLOW_POLL_MS, STUCK_HINT_AFTER_MS, checkSecondsLeft, pollDelayMs, showWaitingHint } from './timing.js';

describe('showWaitingHint', () => {
  it('stays quiet for the first minute, then suggests what may be wrong', () => {
    expect(showWaitingHint(1_000, 1_000 + STUCK_HINT_AFTER_MS - 1)).toBe(false);
    expect(showWaitingHint(1_000, 1_000 + STUCK_HINT_AFTER_MS)).toBe(true);
  });
  it('not while the wait has not begun', () => {
    expect(showWaitingHint(null, 10 * STUCK_HINT_AFTER_MS)).toBe(false);
  });
});

describe('checkSecondsLeft: the 5-second lock on "Xong"', () => {
  it('counts down in whole seconds, rounded up, and never below 0', () => {
    const readyAt = 10_000 + CHECK_WAIT_MS;
    expect(checkSecondsLeft(readyAt, 10_000)).toBe(5);
    expect(checkSecondsLeft(readyAt, 10_001)).toBe(5);
    expect(checkSecondsLeft(readyAt, 11_000)).toBe(4);
    expect(checkSecondsLeft(readyAt, 14_999)).toBe(1);
    expect(checkSecondsLeft(readyAt, 15_000)).toBe(0);
    expect(checkSecondsLeft(readyAt, 99_000)).toBe(0);
  });
  it('never shows more than the 5-second lock, even when the on-screen clock lags a moment', () => {
    expect(checkSecondsLeft(10_000 + CHECK_WAIT_MS, 9_400)).toBe(5);
  });
  it('is not counting before it starts', () => {
    expect(checkSecondsLeft(null, 1)).toBe(0);
  });
});

describe('pollDelayMs', () => {
  it('is fast while waiting for the first signal or the removal check', () => {
    expect(pollDelayMs('install', false)).toBe(FAST_POLL_MS);
    expect(pollDelayMs('check', false)).toBe(FAST_POLL_MS);
  });
  it('is slow while recording and while following the removal steps (only "Dừng thu" / "Kết thúc" are waited for)', () => {
    expect(pollDelayMs('recording', false)).toBe(SLOW_POLL_MS);
    expect(pollDelayMs('remove', false)).toBe(SLOW_POLL_MS);
    expect(pollDelayMs('check-failed', false)).toBe(SLOW_POLL_MS);
  });
  it('stops when nothing more can change', () => {
    for (const s of ['consent', 'lost', 'ended', 'removed'] as const) expect(pollDelayMs(s, false)).toBeNull();
  });
  it('retries fast when the mentor machine cannot be reached, but still not on a finished screen', () => {
    expect(pollDelayMs('recording', true)).toBe(FAST_POLL_MS);
    expect(pollDelayMs('offline', true)).toBe(FAST_POLL_MS);
    expect(pollDelayMs('ended', true)).toBeNull();
  });
});
