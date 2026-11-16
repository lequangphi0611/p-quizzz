import type { SessionDetailView } from '../../ports/session-repository.js';
import { transitionSession, type TransitionDeps } from './transition-session.js';

/** Members may begin answering. */
export class StartSession {
  constructor(private readonly deps: TransitionDeps) {}

  execute(id: number): Promise<SessionDetailView> {
    return transitionSession(this.deps, id, 'start');
  }
}
