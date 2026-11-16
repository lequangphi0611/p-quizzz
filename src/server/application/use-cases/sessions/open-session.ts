import type { SessionDetailView } from '../../ports/session-repository.js';
import { transitionSession, type TransitionDeps } from './transition-session.js';

/** Mentor opens the lobby. At most one session may be in lobby or running. */
export class OpenSession {
  constructor(private readonly deps: TransitionDeps) {}

  execute(id: number): Promise<SessionDetailView> {
    return transitionSession(this.deps, id, 'open');
  }
}
