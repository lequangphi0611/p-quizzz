import { assertCanFinishEdit, assertCanRequestEdit, assertCanResolveEdit } from '../../../domain/attempt/attempt.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptUnitContext } from '../../ports/attempt-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

interface Deps {
  unitOfWork: UnitOfWork<AttemptUnitContext>;
  clock: Clock;
  events: EventPublisher;
}

/** Member asks to reopen the essay part of their submitted attempt (PRODUCT.md §7.21). A rejected request can be sent again. */
export class RequestEdit {
  constructor(private readonly deps: Deps) {}

  async execute(input: { participantId: number; attemptId: number; reason: string }): Promise<void> {
    const sessionId = await this.deps.unitOfWork.run(async ctx => {
      const attempt = await ctx.attempts.findOwned(input.participantId, input.attemptId);
      if (!attempt) throw new AttemptNotFoundError();
      const participant = await ctx.participants.findById(input.participantId);
      if (!participant) throw new ParticipantNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanRequestEdit({ attempt, sessionStatus: session.status, participantStatus: participant.status });
      await ctx.attempts.setEditRequest(attempt.id, { editStatus: 'pending', editReason: input.reason, editRequestedAt: this.deps.clock.now(), editResolvedAt: null });
      return session.id;
    });
    await this.deps.events.publish(sessionId, 'participants');
  }
}

/** Mentor approves or rejects the pending request of one participant. Only while the session runs. */
export class ResolveEditRequest {
  constructor(private readonly deps: Deps) {}

  async execute(input: { participantId: number; decision: 'approve' | 'reject' }): Promise<void> {
    const sessionId = await this.deps.unitOfWork.run(async ctx => {
      const participant = await ctx.participants.findById(input.participantId);
      if (!participant) throw new ParticipantNotFoundError();
      const session = await ctx.sessions.findById(participant.sessionId);
      if (!session) throw new SessionNotFoundError();
      const attempt = (await ctx.attempts.listByParticipant(participant.id)).find(a => a.submittedAt);
      if (!attempt) throw new AttemptNotFoundError();
      assertCanResolveEdit(attempt, session.status);
      await ctx.attempts.setEditRequest(attempt.id, {
        editStatus: input.decision === 'approve' ? 'approved' : 'rejected',
        editReason: attempt.editReason,
        editRequestedAt: attempt.editRequestedAt,
        editResolvedAt: this.deps.clock.now(),
      });
      return session.id;
    });
    await this.deps.events.publish(sessionId, 'participants');
  }
}

/** Member is done editing: the window closes and the request is `done`. */
export class FinishEdit {
  constructor(private readonly deps: Deps) {}

  async execute(input: { participantId: number; attemptId: number }): Promise<void> {
    const sessionId = await this.deps.unitOfWork.run(async ctx => {
      const attempt = await ctx.attempts.findOwned(input.participantId, input.attemptId);
      if (!attempt) throw new AttemptNotFoundError();
      const participant = await ctx.participants.findById(input.participantId);
      if (!participant) throw new ParticipantNotFoundError();
      assertCanFinishEdit(attempt);
      await ctx.attempts.setEditRequest(attempt.id, { editStatus: 'done', editReason: attempt.editReason, editRequestedAt: attempt.editRequestedAt, editResolvedAt: this.deps.clock.now() });
      return participant.sessionId;
    });
    await this.deps.events.publish(sessionId, 'participants');
  }
}
