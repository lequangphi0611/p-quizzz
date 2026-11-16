import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { assertListEditable, assertNotKicked, type Participant } from '../../../domain/participant/participant.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/**
 * Kicking only flips the status. A kicked member's attempts are ignored everywhere (leaderboard, auto-submit,
 * grading) because those only look at non-kicked participants; nothing is deleted.
 */
export class KickParticipant {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; events: EventPublisher }) {}

  async execute(id: number): Promise<Participant> {
    const updated = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const p = await participants.findById(id);
      if (!p) throw new ParticipantNotFoundError();
      assertListEditable((await sessions.findById(p.sessionId))?.status);
      assertNotKicked(p);
      return participants.update(id, { status: 'kicked' });
    });
    await this.deps.events.publish(updated.sessionId, 'participants');
    await this.deps.events.publish(updated.sessionId, 'leaderboard'); // a kicked member leaves the ranking
    return updated;
  }
}
