import { describe, expect, it } from 'vitest';
import { dayAndClock, dayKeyOf, dayLabel, dayMonth } from './days.js';

// Local-time moments, so the tests do not depend on the machine's time zone.
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('day labels', () => {
  it('keys a moment by its local day, padded so keys sort in time order', () => {
    expect(dayKeyOf(at(2026, 11, 24, 0, 0))).toBe('2026-11-24');
    expect(dayKeyOf(at(2026, 11, 24, 23, 59))).toBe('2026-11-24');
    expect(dayKeyOf(at(2026, 1, 5))).toBe('2026-01-05');
  });
  it('writes the full label with the Vietnamese weekday and dd/mm/yyyy', () => {
    expect(dayLabel(at(2026, 11, 24))).toBe('Thứ Ba, 24/11/2026');
    expect(dayLabel(at(2026, 1, 5))).toBe('Thứ Hai, 05/01/2026');
  });
  it('names every weekday, Sunday included', () => {
    const names = [23, 24, 25, 26, 27, 28, 29].map(d => dayLabel(at(2026, 11, d)).split(',')[0]);
    expect(names).toEqual(['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']);
  });
  it('writes the day and month, and day with clock', () => {
    expect(dayMonth(at(2026, 3, 1))).toBe('01/03');
    expect(dayAndClock(at(2026, 11, 24, 14, 30))).toBe('24/11 14:30');
    expect(dayAndClock(at(2026, 11, 2, 7, 5))).toBe('02/11 07:05');
  });
});
