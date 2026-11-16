import { cleanEmails } from '../../../domain/group/emails.js';
import { NotRosterSessionError, RosterAlreadySavedError } from '../../../domain/group/errors.js';
import { GroupNameTakenError } from '../../../domain/group/errors.js';
import { SessionEndedError, SessionNotFoundError } from '../../../domain/session/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { GroupDetailView, GroupReader } from '../../ports/group-repository.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { GetGroup } from '../groups/groups.js';

interface Deps { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; events: EventPublisher }

/** Mentor lets more emails into ONE session's list (an exception): the saved group it came from is not touched. */
export class AddRosterEmails {
  constructor(private readonly deps: Deps) {}

  async execute(sessionId: number, emails: readonly string[]): Promise<SessionDetailView> {
    const clean = cleanEmails(emails);
    await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      if (session.access !== 'roster') throw new NotRosterSessionError();
      if (session.status === 'closed' || session.status === 'finalized') throw new SessionEndedError();
      await ctx.sessions.addRoster(sessionId, clean);
    });
    await this.deps.events.publish(sessionId, 'participants'); // the mentor's "chưa vào" list changed
    const detail = await this.deps.sessions.findDetail(sessionId);
    if (!detail) throw new SessionNotFoundError();
    return detail;
  }
}

/** Saves a session's typed list as a group, so later sessions can use it (PRODUCT.md §7.22c). */
export class SaveSessionGroup {
  constructor(private readonly deps: Deps & { groups: GroupReader; clock: Clock }) {}

  async execute(sessionId: number, name: string): Promise<GroupDetailView> {
    const id = await this.deps.unitOfWork.run(async ctx => {
      const session = await ctx.sessions.findById(sessionId);
      if (!session) throw new SessionNotFoundError();
      if (session.access !== 'roster') throw new NotRosterSessionError();
      if (session.sourceGroupId !== null) throw new RosterAlreadySavedError();
      if ((await ctx.groups.names()).some(g => g.name.trim().toLowerCase() === name.trim().toLowerCase())) throw new GroupNameTakenError();
      const groupId = await ctx.groups.create({ name, emails: await ctx.sessions.rosterEmails(sessionId), now: this.deps.clock.now() });
      await ctx.sessions.setSourceGroup(sessionId, groupId);
      return groupId;
    });
    return new GetGroup(this.deps.groups).execute(id);
  }
}
