import { describe, expect, it } from 'vitest';
import { describeDays, exportFileName, exportInputError, exportQueryString, formatBytes, paramsFor } from './export.js';

describe('exportQueryString / paramsFor', () => {
  it('sends nothing for "Hôm nay" and the whole class: the server takes today', () => {
    expect(exportQueryString(paramsFor('today', '2026-11-20', '2026-11-22', null))).toBe(''); // days typed earlier do not leak into "Hôm nay"
  });
  it('sends one day as `from` alone, and a range as `from` and `to`', () => {
    expect(exportQueryString(paramsFor('day', '2026-11-23', '2026-11-25', null))).toBe('?from=2026-11-23');
    expect(exportQueryString(paramsFor('range', '2026-11-22', '2026-11-24', null))).toBe('?from=2026-11-22&to=2026-11-24');
  });
  it('lists the chosen members, in the order given', () => {
    expect(exportQueryString(paramsFor('today', '', '', [9, 8]))).toBe('?members=9,8');
    expect(exportQueryString(paramsFor('day', '2026-11-23', '', [8]))).toBe('?from=2026-11-23&members=8');
  });
});

describe('exportInputError', () => {
  it('is fine for "Hôm nay", a day, a range and the whole class', () => {
    expect(exportInputError('today', '', '', null)).toBeNull();
    expect(exportInputError('day', '2026-11-23', '', null)).toBeNull();
    expect(exportInputError('range', '2026-11-22', '2026-11-22', [1])).toBeNull();
  });
  it('asks for a day that is missing, in the words of the field', () => {
    expect(exportInputError('day', '', '', null)).toBe('Chọn ngày');
    expect(exportInputError('range', '', '', null)).toBe('Chọn ngày bắt đầu');
    expect(exportInputError('range', '2026-11-22', '', null)).toBe('Chọn ngày kết thúc');
  });
  it('refuses an end before the start, and a selection with nobody ticked', () => {
    expect(exportInputError('range', '2026-11-24', '2026-11-23', null)).toBe('Ngày kết thúc phải sau hoặc cùng ngày bắt đầu');
    expect(exportInputError('today', '', '', [])).toBe('Chọn ít nhất một bạn');
  });
});

describe('exportFileName', () => {
  it('is safe on any file system and names the days', () => {
    expect(exportFileName('Buổi 1', '2026-11-24', '2026-11-24')).toBe('du-lieu-buoi-1-2026-11-24.zip');
    expect(exportFileName('Đào tạo AI: tuần 2 / nhóm A', '2026-11-22', '2026-11-24')).toBe('du-lieu-dao-tao-ai-tuan-2-nhom-a-2026-11-22_2026-11-24.zip');
    expect(exportFileName('🙂', '2026-11-24', '2026-11-24')).toBe('du-lieu-training-2026-11-24.zip');
  });
});

describe('formatBytes', () => {
  it('rounds up to a unit a person reads at a glance', () => {
    expect(formatBytes(120)).toBe('120 byte');
    expect(formatBytes(1500)).toBe('2 KB');
    expect(formatBytes(1024 * 1024)).toBe('1,0 MB');
    expect(formatBytes(1024 * 1024 * 1.41)).toBe('1,5 MB');
  });
});

describe('describeDays', () => {
  it('writes day/month/year, a range with an en dash', () => {
    expect(describeDays({ from: '2026-11-24', to: '2026-11-24' })).toBe('24/11/2026');
    expect(describeDays({ from: '2026-11-22', to: '2026-11-24' })).toBe('22/11/2026 – 24/11/2026');
  });
});
