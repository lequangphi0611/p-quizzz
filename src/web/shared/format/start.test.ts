import { describe, expect, it } from 'vitest';
import type { SessionStartInfo } from '../../../shared/session-start.js';
import { countReasonOf, formatClockTime, nextStartNotices, startRuleOf, type StartNotice } from './start.js';

const at = (h: number, m: number) => new Date(2026, 10, 18, h, m).getTime();
const info = (over: Partial<SessionStartInfo> = {}): SessionStartInfo => ({
  scheduledAt: null, countdownEndsAt: null, countdownSource: null, startsAt: null, startsInMs: null, early: false, autoStartReady: false, readyMin: null, ready: { count: 0, total: 0 },
  ...over,
});

describe('start labels (PRODUCT.md §7.31)', () => {
  it('formats the time of day and who decides', () => {
    expect(formatClockTime(at(9, 0))).toBe('9:00');
    expect(formatClockTime(at(14, 5))).toBe('14:05');
    expect(startRuleOf(info())).toBe('manual');
    expect(startRuleOf(info({ scheduledAt: 1 }))).toBe('scheduled');
    expect(startRuleOf(info({ scheduledAt: 1, autoStartReady: true }))).toBe('auto');
    expect(startRuleOf(info({ autoStartReady: true }))).toBe('manualAuto');
    expect(countReasonOf({ countdownSource: 'ready', early: true })).toBe('all');
    expect(countReasonOf({ countdownSource: 'now', early: true })).toBe('early');
    expect(countReasonOf({ countdownSource: 'now', early: false })).toBe('mentor');
  });
});

describe('start change notices', () => {
  let id = 0;
  const step = (prev: SessionStartInfo | null, next: SessionStartInfo | null, list: StartNotice[], now = 0) => nextStartNotices(prev, next, list, now, () => ++id);

  it('says when the time moves, merging changes within a minute into one card', () => {
    const one = step(info({ scheduledAt: at(9, 0) }), info({ scheduledAt: at(9, 10) }), []);
    expect(one).toMatchObject([{ kind: 'time', title: 'Giờ bắt đầu đã đổi sang 9:10', sub: 'Trước đó: 9:00.', count: 1 }]);
    const three = step(info({ scheduledAt: at(9, 20) }), info({ scheduledAt: at(9, 15) }), step(info({ scheduledAt: at(9, 10) }), info({ scheduledAt: at(9, 20) }), one, 10_000), 20_000);
    expect(three).toHaveLength(1);
    expect(three[0]).toMatchObject({ id: one[0]!.id, count: 3, sub: '9:00 → 9:10 → 9:20 → 9:15. Chỉ giờ mới nhất có hiệu lực.' });
    // A minute later it is a new card.
    expect(step(info({ scheduledAt: at(9, 15) }), info({ scheduledAt: at(9, 30) }), three, 90_000)).toHaveLength(2);
  });

  it('says when the schedule is set or removed, and when the countdown is cancelled', () => {
    expect(step(info(), info({ scheduledAt: at(9, 0) }), [])[0]).toMatchObject({ kind: 'time', title: 'Mentor đã hẹn bắt đầu lúc 9:00' });
    expect(step(info({ scheduledAt: at(9, 0) }), info(), [])[0]).toMatchObject({ kind: 'cleared', title: 'Mentor đã bỏ giờ hẹn, chờ mentor bắt đầu', sub: 'Trước đó: 9:00.' });
    expect(step(info({ countdownEndsAt: 5 }), info(), [])[0]).toMatchObject({ kind: 'cancel', title: 'Đếm ngược đã dừng' });
  });

  it('says nothing when nothing changed or the session started', () => {
    const s = info({ scheduledAt: at(9, 0), ready: { count: 1, total: 2 } });
    expect(step(s, { ...s, ready: { count: 2, total: 2 } }, [])).toEqual([]);
    expect(step(s, null, [])).toEqual([]);
  });
});
