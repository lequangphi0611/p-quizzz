import type { SessionDetailView } from '../../ports/session-repository.js';
import { transitionSession, type TransitionDeps } from './transition-session.js';

/** Submits unfinished attempts and, when no essay needs grading, finalizes at once. */
export class CloseSession {
  constructor(private readonly deps: TransitionDeps) {}

  execute(id: number): Promise<SessionDetailView> {
    return transitionSession(this.deps, id, 'close');
  }
}
