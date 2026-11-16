import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { assertApprovable, type Participant } from '../../../domain/participant/participant.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantUnitContext } from '../../ports/participant-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export class ApproveParticipant {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<ParticipantUnitContext>; events: EventPublisher }) {}

  async execute(id: number): Promise<Participant> {
    const updated = await this.deps.unitOfWork.run(async ({ sessions, participants }) => {
      const p = await participants.findById(id);
      if (!p) throw new ParticipantNotFoundError();
      assertApprovable(p, (await sessions.findById(p.sessionId))?.status);
      return participants.update(id, { status: 'active' });
    });
    await this.deps.events.publish(updated.sessionId, 'participants');
    return updated;
  }
}
