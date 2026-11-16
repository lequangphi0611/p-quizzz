import { describe, expect, it } from 'vitest';
import { parseScore } from './score.js';

describe('parseScore', () => {
  it('accepts whole and half points, with a dot or a comma', () => {
    expect(parseScore('3', 4)).toEqual({ ok: true, value: 3 });
    expect(parseScore('2,5', 4)).toEqual({ ok: true, value: 2.5 });
    expect(parseScore(' 0.5 ', 4)).toEqual({ ok: true, value: 0.5 });
    expect(parseScore('0', 4)).toEqual({ ok: true, value: 0 });
    expect(parseScore('4', 4)).toEqual({ ok: true, value: 4 });
  });
  it('explains what is wrong', () => {
    expect(parseScore('', 4)).toEqual({ ok: false, message: 'Nhập điểm' });
    expect(parseScore('abc', 4)).toEqual({ ok: false, message: 'Điểm không hợp lệ' });
    expect(parseScore('4,5', 4)).toEqual({ ok: false, message: 'Điểm phải từ 0 đến 4' });
    expect(parseScore('-1', 4)).toEqual({ ok: false, message: 'Điểm phải từ 0 đến 4' });
    expect(parseScore('1,3', 4)).toEqual({ ok: false, message: 'Điểm phải là bội số của 0,5' });
  });
});
