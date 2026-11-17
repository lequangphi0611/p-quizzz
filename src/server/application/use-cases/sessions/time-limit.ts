import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { isExpired, planExtendTime, planSetTimeLimit } from '../../../domain/session/time-limit.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { applyTransition, type TransitionDeps } from './transition-session.js';

interface Deps { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; events: EventPublisher; clock: Clock }

async function detailOf(sessions: SessionReader, id: number): Promise<SessionDetailView> {
  const detail = await sessions.findDetail(id);
  if (!detail) throw new SessionNotFoundError();
  return detail;
}

/** Change, add or remove the time limit while the session has not started (PRODUCT.md §7.27c). */
export class SetTimeLimit {
  constructor(private readonly deps: Deps) {}

  async execute(sessionId: number, timeLimitMinutes: number | null): Promise<SessionDetailView> {
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      await ctx.sessions.update(sessionId, planSetTimeLimit(session, timeLimitMinutes));
    });
    await this.deps.events.publish(sessionId, 'session'); // the lobby shows the minutes
    return detailOf(this.deps.sessions, sessionId);
  }
}

/** "+N phút" for the whole room while the session runs (PRODUCT.md §7.27e). Every member's countdown follows. */
export class ExtendTime {
  constructor(private readonly deps: Deps) {}

  async execute(sessionId: number, minutes: number): Promise<SessionDetailView> {
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      await ctx.sessions.update(sessionId, planExtendTime(session, minutes, this.deps.clock.now()));
    });
    await this.deps.events.publish(sessionId, 'session');
    return detailOf(this.deps.sessions, sessionId);
  }
}

/**
 * Closes every running session whose clock (plus grace) has run out, exactly as the mentor's "Đóng" would
 * (PRODUCT.md §7.27f). Run on a short interval and once at startup, so a server that was off at the deadline catches up.
 * Returns the ids it closed.
 */
export class CloseExpiredSessions {
  constructor(private readonly deps: TransitionDeps) {}

  async execute(): Promise<number[]> {
    const now = this.deps.clock.now();
    const due = (await this.deps.sessions.listActive()).filter(s => isExpired(s, now));
    const closed: number[] = [];
    for (const s of due) {
      // Re-checked inside the unit: the mentor may have closed it or added time a moment ago.
      if (await applyTransition(this.deps, s.id, 'close', isExpired)) closed.push(s.id);
    }
    return closed;
  }
}
