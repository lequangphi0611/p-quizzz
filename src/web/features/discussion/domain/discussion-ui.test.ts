import { describe, expect, it } from 'vitest';
import { commonMistakeId, nextUngraded, optionLetter, percent, questionIndexFromSearch, splitPapers } from './discussion-ui.js';

const opt = (id: number, count: number, isCorrect = false) => ({ id, text: '', isCorrect, count });
const ans = (answerId: number, textAnswer: string | null, manualScore: number | null = null) => ({ answerId, label: '', textAnswer, manualScore, feedback: null });

describe('discussion-ui', () => {
  it('letters and percentages', () => {
    expect([0, 1, 25].map(optionLetter)).toEqual(['A', 'B', 'Z']);
    expect(percent(18, 30)).toBe(60);
    expect(percent(1, 0)).toBe(0);
  });

  it('flags the most-picked wrong option only when it is a clear pattern', () => {
    expect(commonMistakeId({ options: [opt(1, 8), opt(2, 18, true), opt(3, 1)] }, 30)).toBe(1); // 8/30 ≥ 20%
    expect(commonMistakeId({ options: [opt(1, 5), opt(2, 25, true)] }, 30)).toBeNull(); // 5/30 < 20%
    expect(commonMistakeId({ options: [opt(1, 7), opt(2, 7), opt(3, 16, true)] }, 30)).toBeNull(); // tie
    expect(commonMistakeId({ options: [opt(1, 30, true)] }, 30)).toBeNull();
  });

  it('splits blank essays from papers and finds the next ungraded one, wrapping', () => {
    const { papers, blanks } = splitPapers({ answers: [ans(1, 'a', 2), ans(2, '  '), ans(3, 'b'), ans(4, null), ans(5, 'c', 1)] });
    expect(papers.map(p => p.answerId)).toEqual([1, 3, 5]);
    expect(blanks.map(p => p.answerId)).toEqual([2, 4]);
    expect(nextUngraded(papers, 0)).toBe(1);
    expect(nextUngraded(papers, 1)).toBe(1); // wraps back to itself when it is the only one left
    expect(nextUngraded([ans(1, 'a', 1)], 0)).toBeNull();
  });

  it('reads the question from ?q= (1-based), clamped', () => {
    expect(questionIndexFromSearch('?q=3', 5)).toBe(2);
    expect(questionIndexFromSearch('?q=9', 5)).toBe(4);
    expect(questionIndexFromSearch('?q=0', 5)).toBe(0);
    expect(questionIndexFromSearch('?q=abc', 5)).toBe(0);
    expect(questionIndexFromSearch('', 5)).toBe(0);
  });
});
