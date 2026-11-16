import { KickedOutError, NotJoinedError, ReplacedError } from '../../../domain/participant/errors.js';
import type { Participant } from '../../../domain/participant/participant.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { PresenceTracker } from '../../ports/presence-tracker.js';

/**
 * Who is behind this token (the member's browser coming back after a reload)? Used by every `/api/me` request, which is
 * also how the server knows the member is still there (PRODUCT.md §7.23b). A token the mentor replaced says so (403 `replaced`).
 */
export class ResumeParticipant {
  constructor(private readonly participants: ParticipantReader, private readonly presence?: PresenceTracker) {}

  async execute(token: string | undefined): Promise<Participant> {
    const p = token ? await this.participants.findByToken(token) : null;
    if (!p) {
      if (token && (await this.participants.findByReplacedToken(token))) throw new ReplacedError();
      throw new NotJoinedError();
    }
    if (p.status === 'kicked') throw new KickedOutError();
    this.presence?.touch(p.id);
    return p;
  }
}
