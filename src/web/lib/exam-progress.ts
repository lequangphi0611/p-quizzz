import type { AttemptSummary, MemberAnswer } from '../../shared/api/index.js';

/** A question counts as answered when a choice is picked or the essay has non-blank text. */
export function isAnswered(a: { selectedOptionIds?: MemberAnswer['selectedOptionIds']; textAnswer?: MemberAnswer['textAnswer'] } | undefined): boolean {
  if (!a) return false;
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0;
}

/** The attempt to headline on the result screen: the best score, ties to the latest. */
export function headlineAttempt(submitted: readonly AttemptSummary[]): AttemptSummary | null {
  return submitted.reduce<AttemptSummary | null>((best, a) => (best === null || a.score >= best.score ? a : best), null);
}

export const formatPoints = (n: number): string => String(n).replace('.', ',');
