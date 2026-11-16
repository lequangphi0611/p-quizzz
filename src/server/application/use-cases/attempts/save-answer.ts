import { assertCanSaveAnswer, validateAnswer, type AnswerInput } from '../../../domain/attempt/attempt.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptUnitContext } from '../../ports/attempt-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export class SaveAnswer {
  constructor(private readonly unitOfWork: UnitOfWork<AttemptUnitContext>) {}

  execute(input: { participantId: number; attemptId: number; questionId: number; answer: AnswerInput }): Promise<void> {
    return this.unitOfWork.run(async ctx => {
      const attempt = await ctx.attempts.findOwned(input.participantId, input.attemptId);
      if (!attempt) throw new AttemptNotFoundError();
      const participant = await ctx.participants.findById(input.participantId);
      if (!participant) throw new ParticipantNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();

      const question = attempt.questionOrder.includes(input.questionId) ? await ctx.exams.findQuestion(input.questionId) : null;
      assertCanSaveAnswer(attempt, session.status, question?.type);
      await ctx.attempts.saveAnswer(input.attemptId, input.questionId, validateAnswer(attempt, question, input.questionId, input.answer));
    });
  }
}
