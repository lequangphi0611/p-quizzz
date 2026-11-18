import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { SessionPatch, Session } from '../../../domain/session/session.js';
import {
  isStartDue,
  isStartOverdue,
  planAutoStart,
  planCancelCountdown,
  planDropOverdue,
  planReadyCountdown,
  planSchedule,
  planStartCountdown,
  readyToAutoStart,
} from '../../../domain/session/start.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { applyTransition, type TransitionDeps } from './transition-session.js';

// How a session starts (PRODUCT.md §7.31): mentor settings, and the watcher that acts on them.

interface Deps { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; events: EventPublisher; clock: Clock }

/** Loads the session in a unit of work, applies the planned patch, then tells every screen and returns the mentor's view. */
async function change(deps: Deps, sessionId: number, plan: (s: Session, now: Date) => SessionPatch): Promise<SessionDetailView> {
  await deps.unitOfWork.run(async ctx => {
    const session = await ctx.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    const patch = plan(session, deps.clock.now());
    if (Object.keys(patch).length > 0) await ctx.sessions.update(sessionId, patch);
  });
  await deps.events.publish(sessionId, 'session');
  const detail = await deps.sessions.findDetail(sessionId);
  if (!detail) throw new SessionNotFoundError();
  return detail;
}

/** Set, move or remove the scheduled start (§7.31b). */
export class SetStartSchedule {
  constructor(private readonly deps: Deps) {}

  execute(sessionId: number, at: Date | null): Promise<SessionDetailView> {
    return change(this.deps, sessionId, (s, now) => planSchedule(s, at, now));
  }
}

/** "Bắt đầu ngay": the room counts down 10 seconds, then the watcher starts the session (§7.31c). */
export class StartCountdown {
  constructor(private readonly deps: Deps) {}

  execute(sessionId: number): Promise<SessionDetailView> {
    return change(this.deps, sessionId, planStartCountdown);
  }
}

/** Mentor cancels the countdown; "everyone ready" is turned off with it (§7.31c). */
export class CancelCountdown {
  constructor(private readonly deps: Deps) {}

  execute(sessionId: number): Promise<SessionDetailView> {
    return change(this.deps, sessionId, planCancelCountdown);
  }
}

/** "Tự bắt đầu khi mọi người sẵn sàng" on/off, and the least number of people (§7.31e). */
export class SetAutoStart {
  constructor(private readonly deps: Deps) {}

  execute(sessionId: number, enabled: boolean, readyMin: number): Promise<SessionDetailView> {
    return change(this.deps, sessionId, s => planAutoStart(s, enabled, readyMin));
  }
}

type Outcome = 'due' | 'changed' | null;

/**
 * Acts on every lobby's start plan (§7.31): starts the session when its time has come; drops a start time that passed
 * while the server was off or asleep; begins the 10-second countdown once everyone is ready. Run every second (and so at
 * startup too, where it drops what went overdue). Each session is re-checked inside its own unit of work, so a mentor's
 * "Huỷ", "Đổi giờ" or a start that lands first wins. One session failing is reported and does not hold up the others.
 * Returns the ids it started.
 */
export class StartDueSessions {
  constructor(private readonly deps: TransitionDeps) {}

  async execute(onError: (err: unknown) => void = () => {}): Promise<number[]> {
    const started: number[] = [];
    for (const id of await this.deps.sessions.listLobbyIdsWithStartPlan()) {
      try {
        const outcome = await this.deps.unitOfWork.run(async (ctx): Promise<Outcome> => {
          const s = await ctx.sessions.findById(id);
          const now = this.deps.clock.now();
          if (!s || s.status !== 'lobby') return null;
          if (isStartOverdue(s, now)) {
            await ctx.sessions.update(id, planDropOverdue(s, now));
            return 'changed';
          }
          if (isStartDue(s, now)) return 'due';
          if (readyToAutoStart(s, await ctx.lobby.count(id))) {
            await ctx.sessions.update(id, planReadyCountdown(now));
            return 'changed';
          }
          return null;
        });
        if (outcome === 'changed') await this.deps.events.publish(id, 'session');
        if (outcome === 'due' && (await applyTransition(this.deps, id, 'start', isStartDue))) started.push(id);
      } catch (err) {
        onError(err);
      }
    }
    return started;
  }
}
