import type { SessionStatus } from '../../../shared/session-state.js';
import type { RubricCriterion } from '../../../shared/rubric.js';
import { hasRubric } from '../../../shared/rubric.js';
import type { Answer } from '../attempt/attempt.js';
import { AiUnavailableError, NoRubricError, ResultsFinalizedError, GradingNotOpenError, NotEssayError } from './errors.js';

// AI grading suggestions (PRODUCT.md §7.28). A suggestion is never a score: only the mentor's grade counts.

export type AiSuggestionStatus = 'queued' | 'running' | 'done' | 'failed';
export type AiUse = 'accepted' | 'edited';

export interface AiCriterion {
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface AiSuggestion {
  id: number;
  answerId: number;
  status: AiSuggestionStatus;
  score: number | null;
  feedback: string | null;
  criteria: AiCriterion[] | null;
  suspicious: boolean;
  suspiciousReason: string | null;
  suspiciousLines: number[] | null;
  error: string | null;
  model: string | null;
  used: AiUse | null;
  requestedAt: Date;
  finishedAt: Date | null;
}

/** What the grader returns before the domain checks it. */
export interface RawSuggestion {
  score: number;
  feedback: string;
  criteria: AiCriterion[];
  suspicious: boolean;
  suspiciousReason: string | null;
  suspiciousLines: number[];
  model: string | null;
}

/** Raised when the grader's answer does not fit the question: the run fails with "AI trả kết quả không hợp lệ". */
export class InvalidSuggestionError extends Error {}

/** A suggestion is "alive" while queued, running or done: asking again must not create a duplicate. */
export const isAlive = (s: Pick<AiSuggestion, 'status'> | undefined): boolean => !!s && s.status !== 'failed';

/** In the order the mentor would hit the problems: essay, closed (not finalized), has a rubric, AI available. */
export function assertCanSuggest(f: { questionType: 'single' | 'multi' | 'essay'; explanation: string | null; sessionStatus: SessionStatus; available: boolean }): void {
  if (f.questionType !== 'essay') throw new NotEssayError();
  if (f.sessionStatus === 'finalized') throw new ResultsFinalizedError();
  if (f.sessionStatus !== 'closed') throw new GradingNotOpenError();
  if (!hasRubric(f.explanation)) throw new NoRubricError();
  if (!f.available) throw new AiUnavailableError();
}

export const isBlankText = (text: string | null): boolean => !text || text.trim() === '';

/**
 * Which answers to send: written (not blank), not graded by the mentor, and without a live suggestion (none yet, or failed).
 * With `only`, just those answers (retrying a few).
 */
export function pickAnswersToSuggest(
  answers: Pick<Answer, 'id' | 'textAnswer' | 'manualScore'>[],
  suggestions: Map<number, Pick<AiSuggestion, 'status'>>,
  only?: number[],
): number[] {
  const allow = only ? new Set(only) : null;
  return answers
    .filter(a => (!allow || allow.has(a.id)) && !isBlankText(a.textAnswer) && a.manualScore === null && !isAlive(suggestions.get(a.id)))
    .map(a => a.id);
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

/**
 * Checks the grader's answer against the question. The score must be a 0.5 step within [0, points]; when the rubric was
 * split into criteria the AI must score each of them (max taken from the rubric). Suspicious lines outside the answer are dropped.
 */
export function normalizeSuggestion(raw: RawSuggestion, points: number, rubric: RubricCriterion[] | null, answerLines: number): RawSuggestion {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!ok(raw.score) || raw.score < 0 || raw.score > points || roundHalf(raw.score) !== raw.score) throw new InvalidSuggestionError('score');
  let criteria = raw.criteria.map(c => ({ label: String(c.label ?? '').trim(), score: c.score, max: c.max, note: String(c.note ?? '').trim() }));
  if (rubric) {
    if (criteria.length !== rubric.length) throw new InvalidSuggestionError('criteria count');
    criteria = criteria.map((c, i) => ({ ...c, label: `T${i + 1}`, max: rubric[i]!.points }));
  }
  for (const c of criteria) if (!ok(c.score) || !ok(c.max) || c.score < 0 || c.score > c.max) throw new InvalidSuggestionError('criterion');
  // The criteria are the reason for the score: a total that disagrees with them would mislead the mentor.
  if (criteria.length > 0 && Math.abs(criteria.reduce((t, c) => t + c.score, 0) - raw.score) > 1e-9) throw new InvalidSuggestionError('criteria sum');
  const lines = [...new Set(raw.suspiciousLines.filter(n => Number.isInteger(n) && n >= 1 && n <= answerLines))].sort((a, b) => a - b);
  return {
    score: raw.score,
    feedback: raw.feedback.trim(),
    criteria,
    suspicious: !!raw.suspicious,
    suspiciousReason: raw.suspicious ? raw.suspiciousReason?.trim() || 'Bài có câu nhắm vào người chấm.' : null,
    suspiciousLines: raw.suspicious ? lines : [],
    model: raw.model,
  };
}
