import type { SessionAction } from '../../../../shared/session-state.js';
import { AnotherSessionActiveError, SessionNotFoundError } from '../../../domain/session/errors.js';
import { assertTransition, planClose, planFinalize, planOpen, planStart } from '../../../domain/session/lifecycle.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';
import type { SessionPatch } from '../../../domain/session/session.js';
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
  let autoSubmitted = 0;

  await deps.unitOfWork.run(async ctx => {
    const session = await ctx.sessions.findById(id);
    if (!session) throw new SessionNotFoundError();
    assertTransition(session, action);

    const now = deps.clock.now();
    let patch: SessionPatch;

    if (action === 'open') {
      // At most one session in lobby/running (PRODUCT.md §7.5).
      if (await ctx.sessions.hasActiveOtherThan(id)) throw new AnotherSessionActiveError();
      // A fresh code every time a session opens.
      patch = planOpen(now, await newRoomCode(deps.random, code => ctx.sessions.roomCodeInUse(code)));
    } else if (action === 'start') {
      patch = planStart(now);
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
  });

  await deps.events.publish(id, 'session');
  if (autoSubmitted > 0) {
    await deps.events.publish(id, 'leaderboard'); // closing just submitted people's work
    await deps.events.publish(id, 'participants');
  }
  const detail = await deps.sessions.findDetail(id);
  if (!detail) throw new SessionNotFoundError();
  return detail;
}
