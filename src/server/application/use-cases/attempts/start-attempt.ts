import { assertCanStart, planOrder } from '../../../domain/attempt/attempt.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptUnitContext } from '../../ports/attempt-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { Random } from '../../ports/random.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { AttemptViewData } from './attempt-data.js';

export class StartAttempt {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<AttemptUnitContext>; clock: Clock; random: Random; events: EventPublisher }) {}

  async execute(participantId: number): Promise<AttemptViewData> {
    const { data, sessionId } = await this.deps.unitOfWork.run(async ctx => {
      const participant = await ctx.participants.findById(participantId);
      if (!participant) throw new ParticipantNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanStart({ sessionStatus: session.status, participantStatus: participant.status, existing: await ctx.attempts.listByParticipant(participantId) });

      const exam = await ctx.exams.findById(session.examId);
      if (!exam) throw new ExamNotFoundError();
      // The order is fixed here, when the attempt is created, so F5 never reshuffles it.
      const { questionOrder, optionOrder } = planOrder(exam, session.shuffle, n => this.deps.random.int(n));
      const attempt = await ctx.attempts.create({ participantId, attemptNo: 1, questionOrder, optionOrder, startedAt: this.deps.clock.now() });
      return { data: { attempt, answers: [], exam, sessionStatus: session.status }, sessionId: session.id };
    });
    await this.deps.events.publish(sessionId, 'participants'); // the mentor's progress column changes
    return data;
  }
}
