import { describe, expect, it } from 'vitest';
import { notCorrectIndexes, retrySecondsFrom, reviewMark } from './member-ui.js';
import { plainPrompt } from '../shared/ui/member/review-mark.js';

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
  it('flattens prompts to one plain line', () => {
    expect(plainPrompt('Khi nào dùng `merge`,\n**khi nào** `rebase`?')).toBe('Khi nào dùng merge, khi nào rebase?');
  });
});
