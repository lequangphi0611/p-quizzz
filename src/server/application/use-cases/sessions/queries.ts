import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { ActiveSessionView, SessionDetailView, SessionReader, SessionSummaryView } from '../../ports/session-repository.js';

export class ListSessions {
  constructor(private readonly sessions: SessionReader) {}

  execute(): Promise<SessionSummaryView[]> {
    return this.sessions.list();
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

/** Public: lets members find the room from the root URL. */
export class GetActiveSession {
  constructor(private readonly sessions: SessionReader) {}

  execute(): Promise<ActiveSessionView | null> {
    return this.sessions.findActive();
  }
}

/** Public: the projector follows the active session, or else the one that just ended. */
export class GetLatestSession {
  constructor(private readonly sessions: SessionReader) {}

  execute(): Promise<ActiveSessionView | null> {
    return this.sessions.findLatest();
  }
}
