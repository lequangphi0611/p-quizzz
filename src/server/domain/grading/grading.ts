import { createHash } from 'node:crypto';
import { pickCountedAttempt, totalScore } from '../../../shared/scoring.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { Answer, Attempt } from '../attempt/attempt.js';
import { ParticipantKickedError } from '../participant/errors.js';
import type { ParticipantStatus } from '../participant/participant.js';
import {
  DiscussionNotOpenError,
  GradingNotOpenError,
  NotEssayError,
  NotSubmittedYetError,
  ResultsFinalizedError,
  ScoreOutOfRangeError,
} from './errors.js';

/**
 * Stable, per-question shuffle key: the same session + question always gives the same order, different questions give
 * different orders, and it is unrelated to ids or join order. Grading and the discussion screen share it, so "Bài #3"
 * names the same essay in both and the numbering never reveals who joined first.
 */
export const shuffleKey = (sessionId: number, questionId: number, answerId: number): string =>
  createHash('sha256').update(`${sessionId}:${questionId}:${answerId}`).digest('hex');

export const compareKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The attempt of each participant that counts: their single submitted attempt. Pass attempts of active members only
 * (kicked members and people who never submitted have none). Keyed by participant id.
 */
export function pickCountedAttempts(attempts: Attempt[]): Map<number, Attempt> {
  const byParticipant = new Map<number, Attempt[]>();
  for (const a of attempts) if (a.submittedAt) byParticipant.set(a.participantId, [...(byParticipant.get(a.participantId) ?? []), a]);
  const out = new Map<number, Attempt>();
  for (const [pid, list] of byParticipant) {
    const pick = pickCountedAttempt(list.map(a => ({ id: a.id, submittedAt: a.submittedAt!.getTime(), score: totalScore(a), row: a })));
    if (pick) out.set(pid, pick.row);
  }
  return out;
}

export interface EssayProgress {
  graded: number;
  total: number;
}

/** Essay answers of counted attempts. A blank answer needs a score too (usually 0). */
export function essayProgress(answers: Pick<Answer, 'manualScore'>[]): EssayProgress {
  return { graded: answers.filter(a => a.manualScore !== null).length, total: answers.length };
}

/** Official results need every counted essay answer scored. */
export const canFinalize = (p: EssayProgress): boolean => p.total - p.graded === 0;

/** The grading screen opens once the session has closed. */
export function assertGradingOpen(status: SessionStatus): asserts status is 'closed' | 'finalized' {
  if (status !== 'closed' && status !== 'finalized') throw new GradingNotOpenError();
}

export function assertDiscussionOpen(status: SessionStatus): asserts status is 'closed' | 'finalized' {
  if (status !== 'closed' && status !== 'finalized') throw new DiscussionNotOpenError();
}

/**
 * Whether the mentor may score this answer, checked in the order the mentor would hit the problems:
 * essay only, session closed but not finalized, member not kicked, attempt submitted, score within the question's points.
 */
export function assertGradable(f: {
  questionType: 'single' | 'multi' | 'essay';
  questionPoints: number;
  sessionStatus: SessionStatus;
  participantStatus: ParticipantStatus;
  attemptSubmitted: boolean;
  score: number;
}): void {
  if (f.questionType !== 'essay') throw new NotEssayError();
  if (f.sessionStatus === 'finalized') throw new ResultsFinalizedError();
  if (f.sessionStatus !== 'closed') throw new GradingNotOpenError();
  if (f.participantStatus !== 'active') throw new ParticipantKickedError();
  if (!f.attemptSubmitted) throw new NotSubmittedYetError();
  if (f.score > f.questionPoints) throw new ScoreOutOfRangeError(f.questionPoints);
}

export const normalizeFeedback = (feedback: string | undefined): string | null => (feedback?.trim() ? feedback.trim() : null);

/** The attempt's manual total is always recomputed from its graded answers, so regrading never double-counts. */
export const manualTotal = (answers: Pick<Answer, 'manualScore'>[]): number => answers.reduce((t, a) => t + (a.manualScore ?? 0), 0);
