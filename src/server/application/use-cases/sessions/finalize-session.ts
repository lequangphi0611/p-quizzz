import type { SessionDetailView } from '../../ports/session-repository.js';
import { transitionSession, type TransitionDeps } from './transition-session.js';

/** Official results; needs every essay graded. */
export class FinalizeSession {
  constructor(private readonly deps: TransitionDeps) {}

  execute(id: number): Promise<SessionDetailView> {
    return transitionSession(this.deps, id, 'finalize');
  }
}
