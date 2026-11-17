import type { ScreenSessionView, SessionReader } from '../../ports/session-repository.js';

/** What `/screen` can follow: the open sessions, or else the one that ended last. Mentor machine only (it carries session names). */
export class ListScreenSessions {
  constructor(private readonly sessions: Pick<SessionReader, 'listScreenSessions' | 'findLatestEnded'>) {}

  async execute(): Promise<{ open: ScreenSessionView[]; latestEnded: ScreenSessionView | null }> {
    const open = await this.sessions.listScreenSessions();
    return { open, latestEnded: open.length === 0 ? await this.sessions.findLatestEnded() : null };
  }
}
