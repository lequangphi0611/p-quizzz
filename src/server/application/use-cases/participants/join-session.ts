import type { Participant } from '../../../domain/participant/participant.js';
import { isValidEmail } from '../../../../shared/email-list.js';
import { InvalidEmailError } from '../../../domain/participant/errors.js';
import { assertCanJoin, assertEmailFree, assertNameFree, rosterDecision, statusOnJoin } from '../../../domain/participant/participant.js';
import { findHolder } from '../../../domain/rejoin/rejoin.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { TokenGenerator } from '../../ports/token-generator.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/**
 * A member joins an open session with its room code and a name (plus an email in a roster session, PRODUCT.md §7.22).
 * `displayName`, `email` and `roomCode` are already normalized (JoinBody does it). In a free session the email is ignored.
 */
export class JoinSession {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; clock: Clock; tokens: TokenGenerator; events: EventPublisher }) {}

  async execute(input: { sessionId: number; displayName: string; roomCode: string; email?: string }): Promise<{ token: string; participant: Participant }> {
    const token = this.deps.tokens.generate();
    const participant = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const session = await sessions.findById(input.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanJoin(session, input.roomCode);
      const others = await participants.listNotKicked(input.sessionId);
      let email: string | null = null;
      let status = statusOnJoin(session.autoApprove);
      if (session.access === 'roster') {
        email = input.email ?? '';
        if (!email) throw new InvalidEmailError('Nhập email của bạn');
        if (!isValidEmail(email)) throw new InvalidEmailError();
        // The list decides first: a stranger learns nothing about who has already joined (PRODUCT.md §7.22e).
        status = rosterDecision(await sessions.hasRosterEmail(input.sessionId, email), session.outsiderPolicy);
      }
      // The mentor may have said "let them back in" for this very person: then the seat is taken over, once (PRODUCT.md §7.23e).
      const holder = findHolder(others, session, { email, displayName: input.displayName });
      if (holder?.rejoinAllowedUntil && holder.rejoinAllowedUntil.getTime() > this.deps.clock.now().getTime()) {
        await participants.setRejoinAllowedUntil(holder.id, null);
        return participants.replaceToken(holder.id, token);
      }
      if (session.access === 'roster') assertEmailFree(others, email!);
      assertNameFree(others, input.displayName, undefined, true);
      return participants.add({
        sessionId: input.sessionId,
        displayName: input.displayName,
        email,
        token,
        status,
        joinedAt: this.deps.clock.now(),
      });
    });
    await this.deps.events.publish(input.sessionId, 'participants');
    return { token, participant };
  }
}
