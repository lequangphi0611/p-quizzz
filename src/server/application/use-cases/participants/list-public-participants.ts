import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { SessionReader } from '../../ports/session-repository.js';

/** Public list for the projector: who is in the room. Only `active` members, only their names, in join order. */
export class ListPublicParticipants {
  constructor(private readonly deps: { sessions: SessionReader; participants: ParticipantReader }) {}

  async execute(sessionId: number): Promise<{ displayName: string }[]> {
    const session = await this.deps.sessions.findPublic(sessionId);
    if (!session || session.status === 'draft') throw new SessionNotFoundError(); // a draft is not public yet
    return this.deps.participants.listActiveNames(sessionId);
  }
}
