import type { SessionAction } from '../../../../shared/session-state.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { assertTransition, planClose, planFinalize, planOpen, planStart } from '../../../domain/session/lifecycle.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';
import type { Session, SessionPatch } from '../../../domain/session/session.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { Random } from '../../ports/random.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { newRoomCode } from './new-room-code.js';

export interface TransitionDeps {
  unitOfWork: UnitOfWork<SessionUnitContext>;
  sessions: SessionReader;
  clock: Clock;
  random: Random;
  events: EventPublisher;
  modes: SessionModeRegistry;
}

/**
 * Shared by `OpenSession`, `StartSession`, `CloseSession` and `FinalizeSession`. Everything up to and including
 * the status change is one unit of work, so check-and-set is atomic; events go out after the commit.
 */
export async function transitionSession(deps: TransitionDeps, id: number, action: SessionAction): Promise<SessionDetailView> {
  await applyTransition(deps, id, action);
  const detail = await deps.sessions.findDetail(id);
  if (!detail) throw new SessionNotFoundError();
  return detail;
}

/**
 * The transition itself. `onlyIf` is checked inside the unit of work, on the fresh row: when it says no, nothing
 * changes and this returns false (the time-limit watcher uses it so a "+5 phút" that lands first wins).
 */
export async function applyTransition(deps: TransitionDeps, id: number, action: SessionAction, onlyIf?: (session: Session, now: Date) => boolean): Promise<boolean> {
  let autoSubmitted = 0;

  const done = await deps.unitOfWork.run(async ctx => {
    const session = await ctx.sessions.findById(id);
    if (!session) throw new SessionNotFoundError();
    const now = deps.clock.now();
    if (onlyIf && !onlyIf(session, now)) return false;
    assertTransition(session, action);

    let patch: SessionPatch;

    if (action === 'open') {
      // Sessions may run side by side (PRODUCT.md §7.5): each gets its own code and the lowest free slot.
      patch = planOpen(now, await newRoomCode(deps.random, code => ctx.sessions.roomCodeInUse(code)), await ctx.sessions.lowestFreeSlot());
    } else if (action === 'start') {
      patch = planStart(now, session.timeLimitMinutes); // starts the shared clock (PRODUCT.md §7.27d)
    } else if (action === 'close') {
      const mode = deps.modes.get(session.mode);
      if (mode.submitsOpenAttemptsOnClose) autoSubmitted = await ctx.attempts.submitOpenAttempts(id);
      const exam = await ctx.exams.findSummary(session.examId);
      if (!exam) throw new ExamNotFoundError();
      patch = planClose(mode, exam, now);
    } else {
      patch = planFinalize(now, await ctx.grading.count(id));
    }

    await ctx.sessions.update(id, patch);
    return true;
  });
  if (!done) return false;

  await deps.events.publish(id, 'session');
  if (autoSubmitted > 0) {
    await deps.events.publish(id, 'leaderboard'); // closing just submitted people's work
    await deps.events.publish(id, 'participants');
  }
  return true;
}
