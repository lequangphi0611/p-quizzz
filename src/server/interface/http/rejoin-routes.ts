import type { FastifyPluginAsync } from 'fastify';
import { JoinBody, type RejoinRequestResponse, type RejoinStatusResponse } from '../../../shared/api/index.js';
import { NotInRosterError, ParticipantNotFoundError, WrongRoomCodeError } from '../../domain/participant/errors.js';
import { RejoinRequestNotFoundError } from '../../domain/rejoin/rejoin.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import type { AllowRejoin, ApproveRejoinKeep, ApproveRejoinTakeover, CancelRejoin, GetRejoinStatus, RejectRejoin, RequestRejoin } from '../../application/use-cases/rejoin/rejoin-requests.js';
import { sendDomainError } from './domain-errors.js';
import type { JoinLimiter } from './join-limiter.js';
import { parseId } from './params.js';

export interface RejoinUseCases {
  request: RequestRejoin;
  status: GetRejoinStatus;
  cancel: CancelRejoin;
  keep: ApproveRejoinKeep;
  takeover: ApproveRejoinTakeover;
  reject: RejectRejoin;
  allow: AllowRejoin;
}

// Public: "that email/name is me, let me back in" (PRODUCT.md §7.23). The asker holds only the REQUEST's token: it reads
// the request's status and cancels it, nothing else, until the mentor approves and it becomes their participant token.
// Wrong room codes and emails off the list count towards the join limiter (they are guesses); every request also
// counts towards its own tighter limit so nobody can flood the mentor with requests.
export const rejoinPublicRoutes = (uc: Pick<RejoinUseCases, 'request' | 'status' | 'cancel'>, limits: { join: JoinLimiter; requests: JoinLimiter }): FastifyPluginAsync =>
  async app => {
    app.post<{ Params: { id: string } }>('/api/sessions/:id/rejoin-requests', async (req, reply) => {
      for (const limiter of [limits.join, limits.requests]) {
        const wait = limiter.retryAfter(req.ip);
        if (wait > 0) return reply.code(429).header('Retry-After', String(wait)).send({ error: `Thử quá nhiều lần. Thử lại sau ${wait} giây` });
      }
      const sessionId = parseId(req.params.id);
      if (!sessionId) return reply.code(404).send({ error: new SessionNotFoundError().message });
      const body = JoinBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        limits.requests.fail(req.ip);
        const res: RejoinRequestResponse = await uc.request.execute({ sessionId, ...body.data });
        return reply.code(res.status === 'approved' ? 200 : 201).send(res);
      } catch (err) {
        if (err instanceof WrongRoomCodeError || err instanceof NotInRosterError) limits.join.fail(req.ip);
        return sendDomainError(reply, err);
      }
    });

    const tokenOf = (req: { headers: Record<string, string | string[] | undefined> }) => {
      const t = req.headers['x-participant-token'];
      return typeof t === 'string' ? t : undefined;
    };

    app.get('/api/rejoin/status', async (req, reply): Promise<RejoinStatusResponse | undefined> => {
      try {
        return await uc.status.execute(tokenOf(req));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.post('/api/rejoin/cancel', async (req, reply) => {
      try {
        await uc.cancel.execute(tokenOf(req));
        return reply.code(204).send();
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };

// Mentor routes (inside the requireMentor scope of /api/admin).
export const rejoinAdminRoutes = (uc: Pick<RejoinUseCases, 'keep' | 'takeover' | 'reject' | 'allow'>): FastifyPluginAsync =>
  async app => {
    for (const [action, useCase] of [['approve-keep', uc.keep], ['approve-takeover', uc.takeover], ['reject', uc.reject]] as const) {
      app.post<{ Params: { id: string } }>(`/rejoin-requests/:id/${action}`, async (req, reply) => {
        const id = parseId(req.params.id);
        if (!id) return reply.code(404).send({ error: new RejoinRequestNotFoundError().message });
        try {
          await useCase.execute(id);
          return reply.code(204).send();
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });
    }

    app.post<{ Params: { id: string } }>('/participants/:id/allow-rejoin', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new ParticipantNotFoundError().message });
      try {
        return { until: (await uc.allow.execute(id)).getTime() };
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
