import type { GradingAnswer } from '../../shared/api/index.js';

export const isBlank = (a: Pick<GradingAnswer, 'textAnswer'>): boolean => !a.textAnswer || a.textAnswer.trim() === '';

export { parseScore } from '../shared/grading/score.js';
// Same formatting as points elsewhere (decimal comma); kept under this name for the grading page until P5-2.
export { formatPoints as formatScore } from '../shared/format/points.js';

/** Display name, or "Bài #k" (k = 1-based position) while blind grading hides names. */
export const answerLabel = (a: Pick<GradingAnswer, 'displayName'>, index: number, blind: boolean): string => (blind ? `Bài #${index + 1}` : a.displayName);
