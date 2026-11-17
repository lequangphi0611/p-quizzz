import type { SessionDetailView } from '../../ports/session-repository.js';
import { transitionSession, type TransitionDeps } from './transition-session.js';

/** Mentor opens the lobby. Any number of sessions may be open at once (PRODUCT.md §7.5). */
export class OpenSession {
  constructor(private readonly deps: TransitionDeps) {}

  execute(id: number): Promise<SessionDetailView> {
    return transitionSession(this.deps, id, 'open');
  }
}
