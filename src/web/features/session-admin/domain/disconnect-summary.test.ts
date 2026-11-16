import { describe, expect, it } from 'vitest';
import { allowRemainingMinutes, massDisconnect } from './disconnect-summary.js';

const NOW = 10_000_000;
const p = (lastSeenAt: number | null, online = false, status: 'active' | 'pending' | 'kicked' = 'active') => ({ status, connection: { online, lastSeenAt } });

describe('massDisconnect', () => {
  it('three or more who went quiet within 30 seconds of each other are one event, counted from the first', () => {
    const r = massDisconnect([p(NOW - 60_000), p(NOW - 55_000), p(NOW - 45_000), p(NOW - 20_000, true)], NOW);
    expect(r).toEqual({ count: 3, since: NOW - 60_000 });
  });

  it('two drops are not enough; drops far apart are separate events', () => {
    expect(massDisconnect([p(NOW - 60_000), p(NOW - 50_000)], NOW)).toBeNull();
    expect(massDisconnect([p(NOW - 200_000), p(NOW - 120_000), p(NOW - 40_000)], NOW)).toBeNull();
  });

  it('only people still offline and not kicked count; people never seen do not', () => {
    expect(massDisconnect([p(NOW - 60_000, true), p(NOW - 59_000, true), p(NOW - 58_000), p(null), p(NOW - 57_000, false, 'kicked')], NOW)).toBeNull();
  });

  it('an old drop is history, not news', () => {
    expect(massDisconnect([p(NOW - 600_000), p(NOW - 599_000), p(NOW - 598_000)], NOW)).toBeNull();
  });

  it('picks the biggest cluster when there are two', () => {
    const r = massDisconnect([p(NOW - 250_000), p(NOW - 249_000), p(NOW - 248_000), p(NOW - 60_000), p(NOW - 59_000), p(NOW - 58_000), p(NOW - 57_000)], NOW);
    expect(r).toEqual({ count: 4, since: NOW - 60_000 });
  });
});

describe('allowRemainingMinutes', () => {
  it('minutes left, rounded up; null when none or lapsed', () => {
    expect(allowRemainingMinutes(NOW + 7 * 60_000 - 1, NOW)).toBe(7);
    expect(allowRemainingMinutes(NOW + 1_000, NOW)).toBe(1);
    expect(allowRemainingMinutes(NOW - 1, NOW)).toBeNull();
    expect(allowRemainingMinutes(null, NOW)).toBeNull();
  });
});
