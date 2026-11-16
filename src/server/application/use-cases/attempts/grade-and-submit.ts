import { gradeAttempt, type Attempt } from '../../../domain/attempt/attempt.js';
import type { Exam } from '../../../domain/exam/exam.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';

/**
 * Marks the attempt submitted and scores it. Every question gets an `answers` row (blank ones included) so that review
 * and manual grading always have something to point at. Used by `SubmitAttempt` and by closing the session.
 */
export async function gradeAndSubmit(attempts: AttemptRepository, attempt: Attempt, exam: Exam, now: Date): Promise<Attempt> {
  const { scores, autoScore } = gradeAttempt(exam, await attempts.answersOf(attempt.id));
  await attempts.recordAutoScores(attempt.id, scores);
  await attempts.markSubmitted(attempt.id, now, autoScore);
  return { ...attempt, submittedAt: now, autoScore };
}
