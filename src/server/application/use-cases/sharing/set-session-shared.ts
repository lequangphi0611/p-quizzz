import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { assertCanShare } from '../../../domain/sharing/sharing.js';
import type { Clock } from '../../ports/clock.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/** Mentor turns "Chia sẻ phiên này" on or off (PRODUCT.md §7.33a). On only once the session ended; off always works. */
export class SetSessionShared {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; clock: Clock }) {}

  async execute(sessionId: number, shared: boolean): Promise<SessionDetailView> {
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      if (!shared) {
        if (session.sharedAt) await ctx.sessions.update(sessionId, { sharedAt: null });
        return;
      }
      assertCanShare(session.status);
      // Turning it on again keeps the original time ("đang chia sẻ từ …").
      if (!session.sharedAt) await ctx.sessions.update(sessionId, { sharedAt: this.deps.clock.now() });
    });
    const detail = await this.deps.sessions.findDetail(sessionId);
    if (!detail) throw new SessionNotFoundError();
    return detail;
  }
}
