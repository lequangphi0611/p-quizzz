import type { Participant } from '../../../domain/participant/participant.js';
import { assertCanJoin, assertNameFree, statusOnJoin } from '../../../domain/participant/participant.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { TokenGenerator } from '../../ports/token-generator.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/** A member joins the active session with its room code and a name. `displayName` is already normalized and `roomCode` digits-only (JoinBody does both). */
export class JoinSession {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; clock: Clock; tokens: TokenGenerator; events: EventPublisher }) {}

  async execute(input: { sessionId: number; displayName: string; roomCode: string }): Promise<{ token: string; participant: Participant }> {
    const token = this.deps.tokens.generate();
    const participant = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const session = await sessions.findById(input.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanJoin(session, input.roomCode);
      assertNameFree(await participants.listNotKicked(input.sessionId), input.displayName);
      return participants.add({
        sessionId: input.sessionId,
        displayName: input.displayName,
        token,
        status: statusOnJoin(session.autoApprove),
        joinedAt: this.deps.clock.now(),
      });
    });
    await this.deps.events.publish(input.sessionId, 'participants');
    return { token, participant };
  }
}
