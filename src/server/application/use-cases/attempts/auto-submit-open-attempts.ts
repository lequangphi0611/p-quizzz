import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { AttemptAutoSubmitter, SessionRepository } from '../../ports/session-repository.js';
import { gradeAndSubmit } from './grade-and-submit.js';

/**
 * Called inside the close-session unit of work: submits and scores every unfinished attempt with its saved answers.
 * A kicked member's attempts are left alone, they never count. Returns how many were submitted.
 */
export class AutoSubmitOpenAttempts implements AttemptAutoSubmitter {
  constructor(private readonly deps: { attempts: AttemptRepository; sessions: Pick<SessionRepository, 'findById'>; exams: ExamReader; clock: Clock }) {}

  async submitOpenAttempts(sessionId: number): Promise<number> {
    const open = await this.deps.attempts.listOpenOfActiveMembers(sessionId);
    if (open.length === 0) return 0;
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    const exam = await this.deps.exams.findById(session.examId);
    if (!exam) throw new ExamNotFoundError();
    const now = this.deps.clock.now();
    for (const attempt of open) await gradeAndSubmit(this.deps.attempts, attempt, exam, now);
    return open.length;
  }
}
