import type { FastifyPluginAsync } from 'fastify';
import { DisplayNameBody, JoinBody, type JoinResponse, type PublicParticipant, type RosterCounts } from '../../../shared/api/index.js';
import type { ApproveParticipant } from '../../application/use-cases/participants/approve-participant.js';
import type { JoinSession } from '../../application/use-cases/participants/join-session.js';
import type { GetRosterCounts } from '../../application/use-cases/participants/get-roster-counts.js';
import type { KickParticipant } from '../../application/use-cases/participants/kick-participant.js';
import type { ListPublicParticipants } from '../../application/use-cases/participants/list-public-participants.js';
import type { RenameParticipant } from '../../application/use-cases/participants/rename-participant.js';
import { NotInRosterError, ParticipantNotFoundError, WrongRoomCodeError } from '../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import { sendDomainError } from './domain-errors.js';
import { createJoinLimiter, type JoinLimiter } from './join-limiter.js';
import { parseId } from './params.js';
import { toParticipantInfoDto } from './presenters/participant-presenter.js';

export interface ParticipantUseCases {
  join: JoinSession;
  rename: RenameParticipant;
  kick: KickParticipant;
  approve: ApproveParticipant;
  listPublic: ListPublicParticipants;
  rosterCounts: GetRosterCounts;
}

const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Public: a member joins the active session with its room code and a name.
export const joinRoutes = (uc: Pick<ParticipantUseCases, 'join'>): FastifyPluginAsync<{ limiter?: JoinLimiter }> =>
  async (app, opts) => {
    const limiter = opts.limiter ?? createJoinLimiter();
    app.post<{ Params: { id: string } }>('/api/sessions/:id/join', async (req, reply) => {
      // Guessing the 6-digit code is slowed down per client address (req.ip is the socket peer, see buildApp).
      const wait = limiter.retryAfter(req.ip);
      if (wait > 0) return reply.code(429).header('Retry-After', String(wait)).send({ error: `Nhập sai mã phòng quá nhiều lần. Thử lại sau ${wait} giây` });

      const sessionId = parseId(req.params.id);
      if (!sessionId) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
      const body = JoinBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      try {
        const { token, participant } = await uc.join.execute({ sessionId, ...body.data });
        const res: JoinResponse = { token, participant: toParticipantInfoDto(participant) };
        return reply.code(201).send(res);
      } catch (err) {
        // A wrong room code and an email that is not on the list both count: neither may be guessed at speed.
        if (err instanceof WrongRoomCodeError || err instanceof NotInRosterError) limiter.fail(req.ip);
        return sendDomainError(reply, err);
      }
    });
  };

// Public list for the projector: who is in the room.
export const publicParticipantsRoutes = (uc: Pick<ParticipantUseCases, 'listPublic'>): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/api/sessions/:id/participants', async (req, reply): Promise<PublicParticipant[] | undefined> => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.listPublic.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };

// Public numbers for the projector: how many of the session's list have joined. Never who (PRODUCT.md §7.24).
export const rosterCountsRoutes = (uc: Pick<ParticipantUseCases, 'rosterCounts'>): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/api/sessions/:id/roster-counts', async (req, reply): Promise<RosterCounts | null | undefined> => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.rosterCounts.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };

// Mentor routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
export const participantsAdminRoutes = (uc: Pick<ParticipantUseCases, 'rename' | 'kick' | 'approve'>): FastifyPluginAsync =>
  async app => {
    app.patch<{ Params: { id: string } }>('/participants/:id', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new ParticipantNotFoundError().message });
      const body = DisplayNameBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      try {
        return toParticipantInfoDto(await uc.rename.execute(id, body.data.displayName));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    for (const [action, useCase] of [['kick', uc.kick], ['approve', uc.approve]] as const) {
      app.post<{ Params: { id: string } }>(`/participants/:id/${action}`, async (req, reply) => {
        const id = parseId(req.params.id);
        if (!id) return reply.code(404).send({ error: new ParticipantNotFoundError().message });
        try {
          return toParticipantInfoDto(await useCase.execute(id));
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });
    }
  };
