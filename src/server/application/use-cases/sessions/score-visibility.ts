import type { ScoreVisibility } from '../../../../shared/api/sessions.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { assertCanChangeScoreVisibility, assertCanReleaseScores } from '../../../domain/session/score-visibility.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

interface Deps { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; events: EventPublisher }

async function detailOf(sessions: SessionReader, id: number): Promise<SessionDetailView> {
  const detail = await sessions.findDetail(id);
  if (!detail) throw new SessionNotFoundError();
  return detail;
}

/** Mentor switches between "show scores on submit" and "hold them until I publish" (PRODUCT.md §7.25), while nobody has submitted. */
export class SetScoreVisibility {
  constructor(private readonly deps: Deps) {}

  async execute(sessionId: number, scoreVisibility: ScoreVisibility): Promise<SessionDetailView> {
    // Anyone who has submitted (kicked people included) may already have seen, or missed, a score.
    const before = await detailOf(this.deps.sessions, sessionId);
    const anySubmitted = before.participants.some(p => p.progress.submittedAt !== null);
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanChangeScoreVisibility(session, anySubmitted);
      await ctx.sessions.update(sessionId, { scoreVisibility });
    });
    // Members' result screens and the projector read whether scores are held from these.
    await this.deps.events.publish(sessionId, 'session');
    await this.deps.events.publish(sessionId, 'leaderboard');
    return detailOf(this.deps.sessions, sessionId);
  }
}

/** "Công bố điểm": scores and ranks appear for everyone at once (members and the projector). Cannot be undone. */
export class ReleaseScores {
  constructor(private readonly deps: Deps & { clock: Clock }) {}

  async execute(sessionId: number): Promise<SessionDetailView> {
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanReleaseScores(session);
      await ctx.sessions.update(sessionId, { scoresReleasedAt: this.deps.clock.now() });
    });
    await this.deps.events.publish(sessionId, 'session');
    await this.deps.events.publish(sessionId, 'leaderboard');
    return detailOf(this.deps.sessions, sessionId);
  }
}
