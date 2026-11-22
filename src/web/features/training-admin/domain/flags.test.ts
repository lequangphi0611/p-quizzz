import { describe, expect, it } from 'vitest';
import { FLAG_CODES } from '../../../../shared/api/index.js';
import { FLAG_INFO, evidenceOf, flagTotals, visibleFlags } from './flags.js';

const zero = Object.fromEntries(FLAG_CODES.map(c => [c, 0])) as Record<(typeof FLAG_CODES)[number], number>;

describe('FLAG_INFO', () => {
  it('names a behaviour for every flag: no verdict words, no person', () => {
    for (const code of FLAG_CODES) {
      const { label, hint, icon } = FLAG_INFO[code];
      expect([label, hint, icon].every(t => t.length > 0)).toBe(true);
      expect(`${label} ${hint}`).not.toMatch(/gian lận|lười|kém|tệ|dở|xếp hạng|điểm/i);
    }
  });
});

describe('visibleFlags', () => {
  it('shows every flag, except that "lặp lệnh lỗi" yields to the stuck chip while the member is stuck', () => {
    expect(visibleFlags({ flags: ['repeated_failure', 'touches_tests'], stuck: false })).toEqual(['repeated_failure', 'touches_tests']);
    expect(visibleFlags({ flags: ['repeated_failure', 'touches_tests'], stuck: true })).toEqual(['touches_tests']);
  });
});

describe('flagTotals', () => {
  it('lists only flags somebody has, in the fixed order, as counts with the class size (no names)', () => {
    const detail = { flagCounts: { ...zero, possible_secret: 1, repeated_request: 6 }, members: Array.from({ length: 10 }, (_, i) => ({ id: i })) } as never;
    const totals = flagTotals(detail);
    expect(totals).toEqual([{ code: 'repeated_request', count: 6, total: 10 }, { code: 'possible_secret', count: 1, total: 10 }]);
    expect(JSON.stringify(totals)).not.toMatch(/displayName/);
  });
  it('is empty when no flag is up', () => {
    expect(flagTotals({ flagCounts: zero, members: [] } as never)).toEqual([]);
  });
});

describe('evidenceOf', () => {
  it('keeps the evidence the page has loaded, in order', () => {
    expect(evidenceOf({ code: 'touches_tests', eventIds: [3, 9, 20] }, [{ id: 3 }, { id: 20 }])).toEqual([3, 20]);
    expect(evidenceOf(undefined, [{ id: 1 }])).toEqual([]);
  });
});
