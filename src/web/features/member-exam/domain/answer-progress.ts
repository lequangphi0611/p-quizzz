import type { MemberAnswer } from '../../../../shared/api/index.js';
import { isAnswered, isMissingReason } from '../../../../shared/answered.js';

/** What the member has typed or picked for one question. `reason`: the reason box of a `{reason}` question (PRODUCT.md §7.32). */
export interface Draft { selected: number[]; text: string; reason: string }
export type Drafts = Record<number, Draft>;

export const EMPTY_DRAFT: Draft = { selected: [], text: '', reason: '' };
export const draftOf = (drafts: Drafts, questionId: number): Draft => drafts[questionId] ?? EMPTY_DRAFT;

export function draftsFromAnswers(answers: readonly (Pick<MemberAnswer, 'questionId' | 'selectedOptionIds' | 'textAnswer'> & { reasonText?: string | null })[]): Drafts {
  const d: Drafts = {};
  for (const a of answers) d[a.questionId] = { selected: a.selectedOptionIds ?? [], text: a.textAnswer ?? '', reason: a.reasonText ?? '' };
  return d;
}

export const withChoice = (drafts: Drafts, questionId: number, selected: number[]): Drafts => ({ ...drafts, [questionId]: { ...draftOf(drafts, questionId), selected } });
export const withText = (drafts: Drafts, questionId: number, text: string): Drafts => ({ ...drafts, [questionId]: { ...draftOf(drafts, questionId), text } });
export const withReason = (drafts: Drafts, questionId: number, reason: string): Drafts => ({ ...drafts, [questionId]: { ...draftOf(drafts, questionId), reason } });

/** Selection after the member taps an option: single replaces, multi toggles. */
export function nextSelection(type: 'single' | 'multi', selected: readonly number[], optionId: number): number[] {
  if (type === 'single') return [optionId];
  return selected.includes(optionId) ? selected.filter(x => x !== optionId) : [...selected, optionId];
}

/**
 * Indexes (0-based, in question order) of answered and unanswered questions, and of `{reason}` questions with a pick but
 * no reason yet (`needsReason`, PRODUCT.md §7.32b). "Answered" still only looks at the pick or the essay text (§7.26b).
 */
export function progressOf(questions: readonly { id: number; requireReason?: boolean }[], drafts: Drafts): { answered: number[]; unanswered: number[]; needsReason: number[] } {
  const answered: number[] = [], unanswered: number[] = [], needsReason: number[] = [];
  questions.forEach((q, i) => {
    const d = drafts[q.id];
    (isAnswered({ selectedOptionIds: d?.selected, textAnswer: d?.text }) ? answered : unanswered).push(i);
    if (isMissingReason({ requireReason: q.requireReason === true }, { selectedOptionIds: d?.selected, reasonText: d?.reason })) needsReason.push(i);
  });
  return { answered, unanswered, needsReason };
}
