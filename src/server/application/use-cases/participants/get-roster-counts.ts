import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { SessionReader } from '../../ports/session-repository.js';

/** Public numbers for the projector: how many of the list have joined. Never says who. Null for a free session. */
export class GetRosterCounts {
  constructor(private readonly sessions: Pick<SessionReader, 'exists' | 'rosterCounts'>) {}

  async execute(sessionId: number): Promise<{ joinedCount: number; rosterSize: number } | null> {
    if (!(await this.sessions.exists(sessionId))) throw new SessionNotFoundError();
    return this.sessions.rosterCounts(sessionId);
  }
}
