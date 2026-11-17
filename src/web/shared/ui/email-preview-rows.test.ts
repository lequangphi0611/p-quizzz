import { describe, expect, it } from 'vitest';
import { parseEmailList } from '../../../shared/email-list.js';
import { filterRows, previewCounts, previewRows, saveNote } from './email-preview-rows.js';

const parsed = parseEmailList('a@x.com\nb\nA@X.com\nphi89@\nc@x.com', 'x.com');

describe('email preview rows', () => {
  it('one row per line in line order, with plain-words notes for the ones to look at', () => {
    const rows = previewRows(parsed);
    expect(rows.map(r => [r.line, r.kind])).toEqual([[1, 'ok'], [2, 'added-domain'], [3, 'duplicate'], [4, 'invalid'], [5, 'ok']]);
    expect(rows[1]).toMatchObject({ raw: 'b', email: 'b@x.com', note: 'Đã thêm domain mặc định' });
    expect(rows[2]!.note).toBe('Trùng dòng 1, gộp làm một');
    expect(rows[3]!.note).toBe('Email chưa đúng định dạng');
  });

  it('"Cần xem" lists only what is not clean; "Hợp lệ" keeps the ones that will be saved', () => {
    const rows = previewRows(parsed);
    expect(filterRows(rows, 'need').map(r => r.line)).toEqual([2, 3, 4]);
    expect(filterRows(rows, 'ok').map(r => r.line)).toEqual([1, 2, 5]);
    expect(filterRows(rows, 'all')).toHaveLength(5);
  });

  it('counts and the note for what saving does', () => {
    expect(previewCounts(parsed)).toEqual({ valid: 3, duplicates: 1, invalid: 1, addedDomain: 1, need: 3, all: 5 });
    expect(saveNote(parsed)).toBe('Khi lưu: bỏ 1 dòng lỗi, gộp 1 dòng trùng.');
    expect(saveNote(parseEmailList('a@x.com'))).toBe('');
  });
});
