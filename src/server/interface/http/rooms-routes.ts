import type { FastifyPluginAsync } from 'fastify';
import { ResolveRoomBody } from '../../../shared/api/index.js';
import { WrongRoomCodeError } from '../../domain/participant/errors.js';
import type { ResolveRoom } from '../../application/use-cases/sessions/resolve-room.js';
import { sendDomainError } from './domain-errors.js';
import type { JoinLimiter } from './join-limiter.js';
import { toActiveSessionDto } from './presenters/session-presenter.js';

// POST /api/rooms/resolve: members find their session by the room code (several sessions may be open, PRODUCT.md §7.5).
// It shares the join limiter: a wrong code here counts the same as a wrong code at join, otherwise the 6-digit code
// could be scanned through this route. The answer carries the exam title only, never the room code or session name.
export const roomsRoutes = (uc: { resolve: ResolveRoom }, limiter: JoinLimiter): FastifyPluginAsync =>
  async app => {
    app.post('/api/rooms/resolve', async (req, reply) => {
      const wait = limiter.retryAfter(req.ip);
      if (wait > 0) return reply.code(429).header('Retry-After', String(wait)).send({ error: `Nhập sai mã phòng quá nhiều lần. Thử lại sau ${wait} giây` });

      const body = ResolveRoomBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        return toActiveSessionDto(await uc.resolve.execute(body.data.roomCode));
      } catch (err) {
        if (err instanceof WrongRoomCodeError) limiter.fail(req.ip);
        return sendDomainError(reply, err);
      }
    });
  };
