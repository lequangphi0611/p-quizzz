// Pure helpers for the projector discussion screen (S17). No DOM.
import type { DiscussionAnswer, DiscussionQuestion } from '../../../../shared/api/index.js';

export const isBlankAnswer = (a: Pick<DiscussionAnswer, 'textAnswer'>): boolean => !a.textAnswer || a.textAnswer.trim() === '';

/** Option letters the class uses to talk about choices. */
export const optionLetter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

export const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * The most-picked wrong option, flagged "Nhầm phổ biến" once revealed — only if it is a real pattern
 * (picked by at least `threshold` of the counted submissions). Ties → none, so we never single out one arbitrarily.
 */
export function commonMistakeId(q: Pick<DiscussionQuestion, 'options'>, submitted: number, threshold = 0.2): number | null {
  const wrong = q.options.filter(o => !o.isCorrect && o.count > 0).sort((a, b) => b.count - a.count);
  const top = wrong[0];
  if (!top || top.count < submitted * threshold) return null;
  if (wrong[1] && wrong[1].count === top.count) return null;
  return top.id;
}

/** Non-blank essays (server's shuffled order, numbered 1…n) and blank ones, which are graded as a group. */
export function splitPapers(q: Pick<DiscussionQuestion, 'answers'>): { papers: DiscussionAnswer[]; blanks: DiscussionAnswer[] } {
  return { papers: q.answers.filter(a => !isBlankAnswer(a)), blanks: q.answers.filter(isBlankAnswer) };
}

/** Next paper without a score after `from`, wrapping around; null when everything is graded. */
export function nextUngraded(papers: readonly Pick<DiscussionAnswer, 'manualScore'>[], from: number): number | null {
  const n = papers.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (papers[i]!.manualScore === null) return i;
  }
  return null;
}

/** `?q=3` (1-based, shareable) → 0-based index, clamped; anything invalid → first question. */
export function questionIndexFromSearch(search: string, count: number): number {
  const n = Number(new URLSearchParams(search).get('q'));
  if (!Number.isInteger(n) || n < 1 || count === 0) return 0;
  return Math.min(n, count) - 1;
}

/** Grading progress of one essay question (blanks included — they need a score too). */
export const questionProgress = (q: Pick<DiscussionQuestion, 'answers'>) => ({ graded: q.answers.filter(a => a.manualScore !== null).length, total: q.answers.length });

/** `?order=priority` turns on the "Cần bàn trước" order (S28, PRODUCT.md §7.30); anything else = exam order. */
export const priorityFromSearch = (search: string): boolean => new URLSearchParams(search).get('order') === 'priority';

/**
 * "Cần bàn trước" (S28, PRODUCT.md §7.30): question indexes, multiple choice with the lowest share of full-mark
 * submissions first (blank = not correct; multi = exact set, as scored), ties in exam order; essays last in exam order.
 * Every question shares the same denominator (`submitted`), so comparing counts is comparing rates; with no counted
 * submission there is no rate and the multiple choice questions keep exam order.
 */
export function priorityOrder(questions: readonly Pick<DiscussionQuestion, 'type' | 'correctCount'>[], submitted: number): number[] {
  const idx = questions.map((_, i) => i);
  const choice = idx.filter(i => questions[i]!.type !== 'essay');
  const essays = idx.filter(i => questions[i]!.type === 'essay');
  if (submitted > 0) choice.sort((a, b) => questions[a]!.correctCount - questions[b]!.correctCount || a - b); // same denominator → compare counts; stable ties
  return [...choice, ...essays];
}

/** Search params of the discussion screen: `?q=` is the 1-based exam number; `order=priority` keeps the S28 order. */
export const discussionSearch = (examIdx: number, priority: boolean): Record<string, string> => ({ q: String(examIdx + 1), ...(priority ? { order: 'priority' } : {}) });
