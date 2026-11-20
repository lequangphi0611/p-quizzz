import { describe, expect, it } from 'vitest';
import type { SharedQuestion } from '../../../../shared/api/index.js';
import { clockOf, dayMonth, failureOf, listPath, longDate, monthGroups, questionFromHash, rowLabel, sessionPath, tallyOf } from './shared-view.js';

const at = (y: number, m: number, d: number, h = 14, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const item = (id: number, startedAt: number | null) => ({ id, examTitle: `Đề ${id}`, startedAt, questionCount: 20 });

describe('dates', () => {
  it('formats day/month, clock and the long date in Vietnamese', () => {
    const t = at(2026, 11, 19, 9, 5);
    expect(dayMonth(t)).toBe('19/11');
    expect(clockOf(t)).toBe('09:05');
    expect(longDate(t)).toBe('Thứ Năm, 19/11/2026');
  });
});

describe('monthGroups', () => {
  it('groups by month in the given order and puts sessions without a date last', () => {
    const groups = monthGroups([item(1, at(2026, 11, 19)), item(2, null), item(3, at(2026, 11, 12)), item(4, at(2026, 10, 28))]);
    expect(groups.map(g => [g.label, g.items.map(i => i.id)])).toEqual([['Tháng 11/2026', [1, 3]], ['Tháng 10/2026', [4]], ['Không rõ ngày thi', [2]]]);
  });

  it('describes a row for screen readers', () => {
    expect(rowLabel(item(1, at(2026, 11, 19)))).toBe('Đề 1, thi Thứ Năm, 19/11/2026 lúc 14:00, 20 câu');
  });
});

describe('tallyOf', () => {
  const q = (over: Partial<SharedQuestion>): SharedQuestion => ({
    id: 1, position: 0, type: 'single', prompt: 'p', body: '', points: 1, explanation: null,
    options: [{ id: 11, position: 1, text: 'B', isCorrect: false }, { id: 10, position: 0, text: 'A', isCorrect: true }],
    distribution: { counts: { 10: 14, 11: 11 }, blank: 3 }, ...over,
  });

  it('rows in option order with letters, counts and rounded percents of the submissions', () => {
    const t = tallyOf(q({}), 28)!;
    expect(t.rows.map(r => [r.label, r.text, r.count, r.pct, r.isCorrect])).toEqual([['A', 'A', 14, 50, true], ['B', 'B', 11, 39, false]]);
    expect(t.blank).toEqual({ count: 3, pct: 11 });
    expect(t.multi).toBe(false);
  });

  it('nothing for essays or without a distribution', () => {
    expect(tallyOf(q({ type: 'essay' }), 3)).toBeNull();
    expect(tallyOf(q({ distribution: null }), 0)).toBeNull();
  });
});

describe('failures and paths', () => {
  it('maps the server codes to screens', () => {
    expect(failureOf({ status: 404, code: 'share_link_invalid' })).toBe('invalid');
    expect(failureOf({ status: 404, code: 'session_not_shared' })).toBe('unshared');
    expect(failureOf({ status: 0 })).toBe('network');
    expect(failureOf(null)).toBe('network');
  });

  it('builds paths and reads the question hash', () => {
    expect(listPath('a b')).toBe('/shared/a%20b');
    expect(sessionPath('t', 7)).toBe('/shared/t/sessions/7');
    expect(questionFromHash('#cau-3', 5)).toBe(2);
    expect(questionFromHash('#cau-9', 5)).toBeNull();
    expect(questionFromHash('#x', 5)).toBeNull();
  });
});
