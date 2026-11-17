import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { SessionReader } from '../../ports/session-repository.js';

/** Public numbers for the projector: how many of the list have joined. Never says who. Null for a free session. */
export class GetRosterCounts {
  constructor(private readonly sessions: Pick<SessionReader, 'findPublic' | 'rosterCounts'>) {}

  async execute(sessionId: number): Promise<{ joinedCount: number; rosterSize: number } | null> {
    const session = await this.sessions.findPublic(sessionId);
    if (!session || session.status === 'draft') throw new SessionNotFoundError(); // a draft is not public yet
    return this.sessions.rosterCounts(sessionId);
  }
}
