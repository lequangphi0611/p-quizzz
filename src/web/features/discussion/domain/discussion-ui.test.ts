import { describe, expect, it } from 'vitest';
import { commonMistakeId, nextUngraded, optionLetter, percent, priorityFromSearch, priorityOrder, questionIndexFromSearch, splitPapers } from './discussion-ui.js';

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

type T = 'single' | 'multi' | 'essay';
const qq = (...xs: [T, number][]) => xs.map(([type, correctCount]) => ({ type, correctCount }));

describe('priorityOrder ("Cần bàn trước", S28)', () => {
  it('fewest full-mark submissions first, ties keep exam order', () => {
    // exam: 1:15/20  2:7/20  3:20/20  4:4/20  5:7/20
    expect(priorityOrder(qq(['single', 15], ['single', 7], ['multi', 20], ['single', 4], ['multi', 7]), 20)).toEqual([3, 1, 4, 0, 2]);
  });
  it('multi uses the exact-set count as given (no partial credit)', () => {
    expect(priorityOrder(qq(['single', 3], ['multi', 1]), 10)).toEqual([1, 0]);
  });
  it('essays go last, in exam order, wherever they sit in the exam', () => {
    expect(priorityOrder(qq(['essay', 0], ['single', 9], ['essay', 0], ['single', 2]), 10)).toEqual([3, 1, 0, 2]);
  });
  it('without counted submissions keeps exam order (no rate to sort by)', () => {
    expect(priorityOrder(qq(['single', 0], ['essay', 0], ['multi', 0]), 0)).toEqual([0, 2, 1]);
  });
  it('handles an essay-only or empty exam', () => {
    expect(priorityOrder(qq(['essay', 0], ['essay', 0]), 5)).toEqual([0, 1]);
    expect(priorityOrder([], 5)).toEqual([]);
  });
  it('does not mutate its input', () => {
    const qs = qq(['single', 5], ['single', 1]);
    priorityOrder(qs, 10);
    expect(qs.map(q => q.correctCount)).toEqual([5, 1]);
  });
  it('reads ?order=priority from the URL', () => {
    expect(priorityFromSearch('q=3&order=priority')).toBe(true);
    expect(priorityFromSearch('q=3')).toBe(false);
    expect(priorityFromSearch('order=exam')).toBe(false);
  });
});
