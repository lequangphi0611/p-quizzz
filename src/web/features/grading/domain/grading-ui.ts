import type { GradingAnswer } from '../../../../shared/api/index.js';

export const isBlank = (a: Pick<GradingAnswer, 'textAnswer'>): boolean => !a.textAnswer || a.textAnswer.trim() === '';

/** Display name, or "Bài #k" (k = 1-based position) while blind grading hides names. */
export const answerLabel = (a: Pick<GradingAnswer, 'displayName'>, index: number, blind: boolean): string => (blind ? `Bài #${index + 1}` : a.displayName);
