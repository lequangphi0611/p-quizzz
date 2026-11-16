import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { assertListEditable, assertNameFree, assertNotKicked, type Participant } from '../../../domain/participant/participant.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export class RenameParticipant {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; events: EventPublisher }) {}

  async execute(id: number, displayName: string): Promise<Participant> {
    const updated = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const p = await participants.findById(id);
      if (!p) throw new ParticipantNotFoundError();
      assertListEditable((await sessions.findById(p.sessionId))?.status);
      assertNotKicked(p);
      assertNameFree(await participants.listNotKicked(p.sessionId), displayName, id);
      return participants.update(id, { displayName });
    });
    await this.deps.events.publish(updated.sessionId, 'participants');
    await this.deps.events.publish(updated.sessionId, 'leaderboard'); // the ranking shows names
    return updated;
  }
}
