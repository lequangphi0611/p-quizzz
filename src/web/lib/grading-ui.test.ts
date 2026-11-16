import { describe, expect, it } from 'vitest';
import { answerLabel, formatScore, isBlank, parseScore } from './grading-ui.js';

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

describe('helpers', () => {
  it('isBlank covers null, empty and whitespace-only answers', () => {
    expect(isBlank({ textAnswer: null })).toBe(true);
    expect(isBlank({ textAnswer: '  \n ' })).toBe(true);
    expect(isBlank({ textAnswer: 'x' })).toBe(false);
  });
  it('answerLabel hides names when grading blind', () => {
    expect(answerLabel({ displayName: 'An' }, 2, false)).toBe('An');
    expect(answerLabel({ displayName: 'An' }, 2, true)).toBe('Bài #3');
  });
  it('formatScore uses a decimal comma', () => expect(formatScore(2.5)).toBe('2,5'));
});
