import { KickedOutError, NotJoinedError } from '../../../domain/participant/errors.js';
import type { Participant } from '../../../domain/participant/participant.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';

/** Who is behind this token (the member's browser coming back after a reload)? Used by every `/api/me` request. */
export class ResumeParticipant {
  constructor(private readonly participants: ParticipantReader) {}

  async execute(token: string | undefined): Promise<Participant> {
    const p = token ? await this.participants.findByToken(token) : null;
    if (!p) throw new NotJoinedError();
    if (p.status === 'kicked') throw new KickedOutError();
    return p;
  }
}
