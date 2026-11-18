import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { assertCanSetReady } from '../../../domain/participant/participant.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/**
 * "Sẵn sàng" / "Huỷ sẵn sàng" in the lobby (PRODUCT.md §7.31d). Whether everyone is now ready is the start watcher's
 * call (it re-checks within a second, inside its own unit of work), so this only records the mark.
 */
export class SetReady {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; events: EventPublisher; clock: Clock }) {}

  async execute(participantId: number, ready: boolean): Promise<void> {
    const sessionId = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const p = await participants.findById(participantId);
      if (!p) throw new ParticipantNotFoundError();
      const session = await sessions.findById(p.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanSetReady(p, session);
      if ((p.readyAt !== null) !== ready) await participants.setReady(p.id, ready ? this.deps.clock.now() : null);
      return p.sessionId;
    });
    await this.deps.events.publish(sessionId, 'participants'); // "Sẵn sàng X/Y" on every lobby screen
  }
}
