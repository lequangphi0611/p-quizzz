import { assertCanWork, assertReasonsComplete, maxAutoScore, missingReasons } from '../../../domain/attempt/attempt.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import type { Attempt } from '../../../domain/attempt/attempt.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { areScoresHidden } from '../../../domain/session/score-visibility.js';
import type { AttemptUnitContext } from '../../ports/attempt-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { gradeAndSubmit } from './grade-and-submit.js';
import { assertNotTimeUp } from '../../../domain/session/time-limit.js';

export interface SubmitResult {
  attempt: Attempt;
  /** Most the automatic part can give (essay points excluded until graded). */
  maxScore: number;
  /** The exam has essays still waiting for the mentor. */
  essayPending: boolean;
  /** The mentor holds scores back (PRODUCT.md §7.25): the response must not carry the score. */
  scoresHidden: boolean;
}

export class SubmitAttempt {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<AttemptUnitContext>; clock: Clock; events: EventPublisher }) {}

  async execute(input: { participantId: number; attemptId: number }): Promise<SubmitResult> {
    const { result, sessionId } = await this.deps.unitOfWork.run(async ctx => {
      const attempt = await ctx.attempts.findOwned(input.participantId, input.attemptId);
      if (!attempt) throw new AttemptNotFoundError();
      const participant = await ctx.participants.findById(input.participantId);
      if (!participant) throw new ParticipantNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanWork(attempt, session.status);
      assertNotTimeUp(session, this.deps.clock.now());

      const exam = await ctx.exams.findById(session.examId);
      if (!exam) throw new ExamNotFoundError();
      // Only the member's own submit checks reasons; closing the session or running out of time submits as is (PRODUCT.md §7.32b).
      assertReasonsComplete(missingReasons(exam, attempt.questionOrder, await ctx.attempts.answersOf(attempt.id)));
      const done = await gradeAndSubmit(ctx.attempts, attempt, exam, this.deps.clock.now());
      return { sessionId: session.id, result: { attempt: done, maxScore: maxAutoScore(exam), essayPending: exam.questions.some(q => q.type === 'essay'), scoresHidden: areScoresHidden(session) } };
    });
    await this.deps.events.publish(sessionId, 'leaderboard');
    await this.deps.events.publish(sessionId, 'participants');
    return result;
  }
}
