import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { ActiveSessionView, SessionDetailView, SessionReader, SessionSummaryView } from '../../ports/session-repository.js';

export class ListSessions {
  constructor(private readonly sessions: SessionReader) {}

  /** `activeOnly`: just the sessions in lobby/running (what the bell and the overview follow). */
  execute(activeOnly = false): Promise<SessionSummaryView[]> {
    return activeOnly ? this.sessions.listActive() : this.sessions.list();
  }
}

export class GetSessionDetail {
  constructor(private readonly sessions: SessionReader) {}

  async execute(id: number): Promise<SessionDetailView> {
    const detail = await this.sessions.findDetail(id);
    if (!detail) throw new SessionNotFoundError();
    return detail;
  }
}

/** Public: the exam title and status of one session (the projector page and the member's follow-up). */
export class GetPublicSession {
  constructor(private readonly sessions: SessionReader) {}

  async execute(id: number): Promise<ActiveSessionView> {
    const found = await this.sessions.findPublic(id);
    if (!found) throw new SessionNotFoundError();
    return found;
  }
}
