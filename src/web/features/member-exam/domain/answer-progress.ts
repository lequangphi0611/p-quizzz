import type { MemberAnswer } from '../../../../shared/api/index.js';

/** What the member has typed or picked for one question. */
export interface Draft { selected: number[]; text: string }
export type Drafts = Record<number, Draft>;

/** A question counts as answered when a choice is picked or the essay has non-blank text. */
export function isAnswered(a: { selectedOptionIds?: MemberAnswer['selectedOptionIds']; textAnswer?: MemberAnswer['textAnswer'] } | undefined): boolean {
  if (!a) return false;
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0;
}

const draftOf = (drafts: Drafts, questionId: number): Draft => drafts[questionId] ?? { selected: [], text: '' };

export function draftsFromAnswers(answers: readonly Pick<MemberAnswer, 'questionId' | 'selectedOptionIds' | 'textAnswer'>[]): Drafts {
  const d: Drafts = {};
  for (const a of answers) d[a.questionId] = { selected: a.selectedOptionIds ?? [], text: a.textAnswer ?? '' };
  return d;
}

export const withChoice = (drafts: Drafts, questionId: number, selected: number[]): Drafts => ({ ...drafts, [questionId]: { ...draftOf(drafts, questionId), selected } });
export const withText = (drafts: Drafts, questionId: number, text: string): Drafts => ({ ...drafts, [questionId]: { ...draftOf(drafts, questionId), text } });

/** Selection after the member taps an option: single replaces, multi toggles. */
export function nextSelection(type: 'single' | 'multi', selected: readonly number[], optionId: number): number[] {
  if (type === 'single') return [optionId];
  return selected.includes(optionId) ? selected.filter(x => x !== optionId) : [...selected, optionId];
}

/** Indexes (0-based, in question order) of answered and unanswered questions. */
export function progressOf(questions: readonly { id: number }[], drafts: Drafts): { answered: number[]; unanswered: number[] } {
  const answered: number[] = [], unanswered: number[] = [];
  questions.forEach((q, i) => (isAnswered({ selectedOptionIds: drafts[q.id]?.selected, textAnswer: drafts[q.id]?.text }) ? answered : unanswered).push(i));
  return { answered, unanswered };
}
