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
