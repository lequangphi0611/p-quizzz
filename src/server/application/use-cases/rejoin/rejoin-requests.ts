import { isValidEmail } from '../../../../shared/email-list.js';
import { InvalidEmailError, ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { assertCanJoin, assertNameFree, rosterDecision } from '../../../domain/participant/participant.js';
import { ALLOW_REJOIN_MS, findHolder, MAX_PENDING_PER_HOLDER, NoHolderError, NotRejoinableError, RejoinNotPendingError, RejoinRequestNotFoundError, TooManyRequestsError, viewOf, type RejoinView } from '../../../domain/rejoin/rejoin.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { ACTIVE_STATUSES } from '../../../../shared/session-state.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ParticipantReader, RejoinUnitContext } from '../../ports/participant-repository.js';
import type { RejoinRequestReader } from '../../ports/rejoin-repository.js';
import type { SessionReader } from '../../ports/session-repository.js';
import type { TokenGenerator } from '../../ports/token-generator.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

interface UnitDeps { unitOfWork: UnitOfWork<RejoinUnitContext>; clock: Clock; events: EventPublisher }

/**
 * A member typed an email/name that already has a person behind it and says "that is me, let me back in" (PRODUCT.md §7.23).
 * Never approved by itself: it goes to the mentor. The one exception is a permission the mentor gave beforehand to exactly
 * that person (`allow-rejoin`), which lets the claimant in straight away, once.
 */
export class RequestRejoin {
  constructor(private readonly deps: UnitDeps & { tokens: TokenGenerator }) {}

  async execute(input: { sessionId: number; roomCode: string; displayName: string; email?: string }): Promise<{ requestId: number | null; token: string; status: 'pending' | 'approved' }> {
    const token = this.deps.tokens.generate();
    const result = await this.deps.unitOfWork.run(async ({ sessions, participants, rejoin }) => {
      const session = await sessions.findById(input.sessionId);
      if (!session) throw new SessionNotFoundError();
      assertCanJoin(session, input.roomCode); // a wrong code counts at the HTTP layer, like at join
      let email: string | null = null;
      if (session.access === 'roster') {
        email = input.email ?? '';
        if (!email || !isValidEmail(email)) throw new InvalidEmailError(email ? undefined : 'Nhập email của bạn');
        rosterDecision(await sessions.hasRosterEmail(input.sessionId, email), 'block'); // only people on the list can claim a seat
      }
      const holder = findHolder(await participants.listNotKicked(input.sessionId), session, { email, displayName: input.displayName });
      if (!holder) throw new NoHolderError();
      const now = this.deps.clock.now();
      if (holder.rejoinAllowedUntil && holder.rejoinAllowedUntil.getTime() > now.getTime()) {
        await participants.replaceToken(holder.id, token); // the mentor said yes beforehand: take the seat now, once
        await participants.setRejoinAllowedUntil(holder.id, null);
        return { requestId: null, status: 'approved' as const };
      }
      // Refuse a name somebody else already uses now, not later when the mentor clicks "impostor" and meets an error about a
      // name they never saw. The holder's own name is fine: the claimant may type the same one.
      assertNameFree((await participants.listNotKicked(input.sessionId)).filter(p => p.id !== holder.id), input.displayName);
      if ((await rejoin.pendingOf(holder.id)).length >= MAX_PENDING_PER_HOLDER) throw new TooManyRequestsError();
      const request = await rejoin.create({ participantId: holder.id, claimantName: input.displayName, token, now });
      return { requestId: request.id, status: 'pending' as const };
    });
    await this.deps.events.publish(input.sessionId, 'participants'); // the mentor's bell and page learn of it
    return { ...result, token };
  }
}

/** What the claimant sees about their own request: they hold only the request's token, so they can read only this. */
export class GetRejoinStatus {
  constructor(private readonly deps: { rejoin: RejoinRequestReader; participants: ParticipantReader; sessions: Pick<SessionReader, 'findPublic'> }) {}

  async execute(token: string | undefined): Promise<{ status: RejoinView; sessionId: number }> {
    const request = token ? await this.deps.rejoin.findByToken(token) : null;
    if (!request) throw new RejoinRequestNotFoundError();
    const holder = await this.deps.participants.findById(request.participantId);
    if (!holder) throw new RejoinRequestNotFoundError();
    const session = await this.deps.sessions.findPublic(holder.sessionId);
    if (!session) throw new SessionNotFoundError();
    return { status: viewOf(request, session.status), sessionId: holder.sessionId };
  }
}

/** The claimant withdraws their request. */
export class CancelRejoin {
  constructor(private readonly deps: UnitDeps & { rejoin: RejoinRequestReader }) {}

  async execute(token: string | undefined): Promise<void> {
    const found = token ? await this.deps.rejoin.findByToken(token) : null;
    if (!found) throw new RejoinRequestNotFoundError();
    let sessionId = 0;
    await this.deps.unitOfWork.run(async ({ participants, rejoin }) => {
      const request = await rejoin.findById(found.id);
      if (!request) throw new RejoinRequestNotFoundError();
      if (request.status !== 'pending') return; // already answered: nothing to withdraw
      sessionId = (await participants.findById(request.participantId))!.sessionId;
      await rejoin.setStatus(request.id, 'cancelled', this.deps.clock.now());
    });
    if (sessionId) await this.deps.events.publish(sessionId, 'participants');
  }
}

/** Loads a still-waiting request and the open session it belongs to, or says why not. */
async function pendingRequest(ctx: RejoinUnitContext, id: number) {
  const request = await ctx.rejoin.findById(id);
  if (!request) throw new RejoinRequestNotFoundError();
  if (request.status !== 'pending') throw new RejoinNotPendingError();
  const holder = await ctx.participants.findById(request.participantId);
  if (!holder) throw new RejoinRequestNotFoundError();
  const session = await ctx.sessions.findById(holder.sessionId);
  if (!session || !ACTIVE_STATUSES.includes(session.status)) throw new NotRejoinableError();
  return { request, holder, session };
}

/** "Cho vào lại, giữ bài": the claimant's device takes the seat; name, answers and rank stay; the old device is told it was replaced. */
export class ApproveRejoinKeep {
  constructor(private readonly deps: UnitDeps) {}

  async execute(requestId: number): Promise<void> {
    let sessionId = 0;
    await this.deps.unitOfWork.run(async ctx => {
      const { request, holder } = await pendingRequest(ctx, requestId);
      if (holder.status === 'kicked') throw new NotRejoinableError();
      sessionId = holder.sessionId;
      const now = this.deps.clock.now();
      await ctx.participants.replaceToken(holder.id, request.token);
      await ctx.participants.setRejoinAllowedUntil(holder.id, null);
      for (const r of await ctx.rejoin.pendingOf(holder.id)) await ctx.rejoin.setStatus(r.id, r.id === request.id ? 'approved' : 'rejected', now);
    });
    await this.deps.events.publish(sessionId, 'participants');
  }
}

/**
 * "Đây là mạo danh": whoever holds the seat is sent out and LOSES their attempt; the claimant comes in as a new person with
 * the name they typed (and the same email). Refused, changing nothing, if that name is taken by somebody else.
 */
export class ApproveRejoinTakeover {
  constructor(private readonly deps: UnitDeps) {}

  async execute(requestId: number): Promise<void> {
    let sessionId = 0;
    await this.deps.unitOfWork.run(async ctx => {
      const { request, holder } = await pendingRequest(ctx, requestId);
      sessionId = holder.sessionId;
      const now = this.deps.clock.now();
      await ctx.participants.update(holder.id, { status: 'kicked' });
      assertNameFree(await ctx.participants.listNotKicked(sessionId), request.claimantName, undefined, true);
      await ctx.participants.add({ sessionId, displayName: request.claimantName, email: holder.email, token: request.token, status: 'active', joinedAt: now });
      for (const r of await ctx.rejoin.pendingOf(holder.id)) await ctx.rejoin.setStatus(r.id, r.id === request.id ? 'approved' : 'rejected', now);
    });
    await this.deps.events.publish(sessionId, 'participants');
    await this.deps.events.publish(sessionId, 'leaderboard'); // the removed person's score leaves the ranking
  }
}

export class RejectRejoin {
  constructor(private readonly deps: UnitDeps) {}

  async execute(requestId: number): Promise<void> {
    let sessionId = 0;
    await this.deps.unitOfWork.run(async ctx => {
      const { request, holder } = await pendingRequest(ctx, requestId);
      sessionId = holder.sessionId;
      await ctx.rejoin.setStatus(request.id, 'rejected', this.deps.clock.now());
    });
    await this.deps.events.publish(sessionId, 'participants');
  }
}

/**
 * The mentor, seeing someone has dropped off, says in advance "let them back in": for a short while entering the same
 * email/name takes the seat over without waiting, once (PRODUCT.md §7.23e).
 */
export class AllowRejoin {
  constructor(private readonly deps: UnitDeps) {}

  async execute(participantId: number): Promise<Date> {
    const until = new Date(this.deps.clock.now().getTime() + ALLOW_REJOIN_MS);
    let sessionId = 0;
    await this.deps.unitOfWork.run(async ({ participants, sessions }) => {
      const p = await participants.findById(participantId);
      if (!p) throw new ParticipantNotFoundError();
      const session = await sessions.findById(p.sessionId);
      if (!session || !ACTIVE_STATUSES.includes(session.status) || p.status === 'kicked') throw new NotRejoinableError();
      sessionId = p.sessionId;
      await participants.setRejoinAllowedUntil(participantId, until);
    });
    await this.deps.events.publish(sessionId, 'participants');
    return until;
  }
}
