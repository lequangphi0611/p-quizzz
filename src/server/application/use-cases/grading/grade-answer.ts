import type { GradeResponse } from '../../../../shared/api/index.js';
import { AnswerNotFoundError } from '../../../domain/grading/errors.js';
import { assertGradable, manualTotal, normalizeFeedback } from '../../../domain/grading/grading.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptUnitContext } from '../../ports/attempt-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { essayProgressOf, loadCountedWork } from './essay-progress.js';

/** The mentor scores one essay answer (0.5 steps). Everything, including the attempt's recomputed manual total, is one unit. */
export class GradeAnswer {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<AttemptUnitContext>; clock: Clock; events: EventPublisher }) {}

  async execute(input: { answerId: number; score: number; feedback?: string }): Promise<GradeResponse> {
    const { response, sessionId } = await this.deps.unitOfWork.run(async ctx => {
      const answer = await ctx.attempts.findAnswerById(input.answerId);
      if (!answer) throw new AnswerNotFoundError();
      const attempt = await ctx.attempts.findById(answer.attemptId);
      const participant = attempt && (await ctx.participants.findById(attempt.participantId));
      const question = await ctx.exams.findQuestion(answer.questionId);
      if (!attempt) throw new AttemptNotFoundError();
      if (!participant) throw new ParticipantNotFoundError();
      if (!question) throw new AnswerNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();

      assertGradable({
        questionType: question.type,
        questionPoints: question.points,
        sessionStatus: session.status,
        participantStatus: participant.status,
        attemptSubmitted: !!attempt.submittedAt,
        score: input.score,
      });

      const updated = await ctx.attempts.gradeAnswer(input.answerId, { manualScore: input.score, feedback: normalizeFeedback(input.feedback), gradedAt: this.deps.clock.now() });
      await ctx.attempts.setManualScore(attempt.id, manualTotal(await ctx.attempts.answersOf(attempt.id)));

      const { graded, total } = essayProgressOf(await loadCountedWork(ctx, session.id, session.examId));
      return {
        sessionId: session.id,
        response: {
          answer: { answerId: updated.id, participantId: participant.id, displayName: participant.displayName, textAnswer: updated.textAnswer, manualScore: updated.manualScore, feedback: updated.feedback },
          graded,
          total,
        },
      };
    });
    await this.deps.events.publish(sessionId, 'leaderboard');
    return response;
  }
}
