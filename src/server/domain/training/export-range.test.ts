import { describe, expect, it } from 'vitest';
import { describeExportRange, resolveExportRange } from './export-range.js';

// Built with the local-time constructor on purpose: the rule is "the calendar of the machine running the app", whatever its zone.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('resolveExportRange', () => {
  it('is today when nothing is given: local midnight to the next local midnight', () => {
    const r = resolveExportRange({}, at(2026, 11, 24, 15, 40));
    expect([r.fromDay, r.toDay]).toEqual(['2026-11-24', '2026-11-24']);
    expect(r.from).toEqual(at(2026, 11, 24));
    expect(r.to).toEqual(at(2026, 11, 25));
  });

  it('is one day when only `from` is given', () => {
    const r = resolveExportRange({ from: '2026-11-20' }, at(2026, 11, 24));
    expect([r.fromDay, r.toDay]).toEqual(['2026-11-20', '2026-11-20']);
    expect(r.to).toEqual(at(2026, 11, 21));
  });

  it('covers every day from `from` to `to`, the last one in full', () => {
    const r = resolveExportRange({ from: '2026-11-20', to: '2026-11-22' }, at(2026, 11, 24));
    expect(r.from).toEqual(at(2026, 11, 20));
    expect(r.to).toEqual(at(2026, 11, 23));
    expect(at(2026, 11, 22, 23, 59) >= r.from && at(2026, 11, 22, 23, 59) < r.to).toBe(true);
    expect(at(2026, 11, 23, 0, 0) < r.to).toBe(false);
  });

  it('rolls over month and year ends', () => {
    expect(resolveExportRange({ from: '2026-12-31' }, at(2026, 1, 1)).to).toEqual(at(2027, 1, 1));
    expect(resolveExportRange({ from: '2026-02-28' }, at(2026, 1, 1)).to).toEqual(at(2026, 3, 1));
  });
});

describe('describeExportRange', () => {
  it('writes day/month/year, a range with an en dash', () => {
    expect(describeExportRange({ fromDay: '2026-11-24', toDay: '2026-11-24' })).toBe('24/11/2026');
    expect(describeExportRange({ fromDay: '2026-11-20', toDay: '2026-11-24' })).toBe('20/11/2026 – 24/11/2026');
  });
});
