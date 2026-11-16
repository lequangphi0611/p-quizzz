import { describe, expect, it } from 'vitest';
import { notCorrectIndexes, plainPrompt, questionList, retrySecondsFrom, reviewMark, shortcutFor } from './member-ui.js';

const k = (key: string, extra: Partial<Parameters<typeof shortcutFor>[0]> = {}) => shortcutFor({ key, inField: false, overlay: false, ...extra });

describe('shortcutFor', () => {
  it('maps arrows, digits and ?', () => {
    expect(k('ArrowLeft')).toEqual({ kind: 'prev' });
    expect(k('ArrowRight')).toEqual({ kind: 'next' });
    expect(k('?')).toEqual({ kind: 'help' });
    expect(k('1')).toEqual({ kind: 'pick', index: 0 });
    expect(k('9')).toEqual({ kind: 'pick', index: 8 });
    expect(k('0')).toBeNull();
    expect(k('Enter')).toBeNull(); // submitting has no shortcut
  });
  it('is off while typing, with an overlay open or with a modifier', () => {
    expect(k('ArrowRight', { inField: true })).toBeNull();
    expect(k('2', { inField: true })).toBeNull();
    expect(k('2', { overlay: true })).toBeNull();
    expect(k('ArrowLeft', { altKey: true })).toBeNull();
    expect(k('1', { ctrlKey: true })).toBeNull();
    expect(k('1', { metaKey: true })).toBeNull();
  });
  it('Esc leaves a field or closes an overlay', () => {
    expect(k('Escape', { inField: true })).toEqual({ kind: 'blur' });
    expect(k('Escape', { overlay: true, inField: true })).toEqual({ kind: 'close' });
    expect(k('Escape')).toBeNull();
  });
});

describe('review marks', () => {
  it('full, zero, partial and pending', () => {
    expect(reviewMark({ type: 'single', points: 1, score: 1 })).toEqual({ kind: 'correct', text: '1/1' });
    expect(reviewMark({ type: 'multi', points: 2, score: 0 })).toEqual({ kind: 'wrong', text: '0/2' });
    expect(reviewMark({ type: 'essay', points: 5, score: 3.5 })).toEqual({ kind: 'partial', text: '3,5/5' });
    expect(reviewMark({ type: 'essay', points: 5, score: null })).toEqual({ kind: 'pending', text: 'Chờ chấm' });
  });
  it('"not correct" keeps wrong, partial and pending', () => {
    const marks = [{ kind: 'correct' }, { kind: 'wrong' }, { kind: 'partial' }, { kind: 'pending' }].map(m => ({ ...m, text: '' })) as Parameters<typeof notCorrectIndexes>[0];
    expect(notCorrectIndexes(marks)).toEqual([1, 2, 3]);
  });
});

describe('small helpers', () => {
  it('reads the wait from the 429 message', () => {
    expect(retrySecondsFrom('Nhập sai mã phòng quá nhiều lần. Thử lại sau 42 giây')).toBe(42);
    expect(retrySecondsFrom('Mã phòng không đúng')).toBe(0);
  });
  it('lists questions and flattens prompts', () => {
    expect(questionList([1, 3])).toBe('Câu 2, Câu 4');
    expect(plainPrompt('Khi nào dùng `merge`,\n**khi nào** `rebase`?')).toBe('Khi nào dùng merge, khi nào rebase?');
  });
});
