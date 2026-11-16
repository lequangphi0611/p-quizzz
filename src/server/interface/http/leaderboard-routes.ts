import type { FastifyPluginAsync } from 'fastify';
import type { GetLeaderboard } from '../../application/use-cases/leaderboard/get-leaderboard.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';

// GET /api/sessions/:id/leaderboard: public, read-only. Realtime clients refetch it on the `leaderboard` SSE event.
export const leaderboardRoutes = (uc: { leaderboard: GetLeaderboard }): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/api/sessions/:id/leaderboard', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.leaderboard.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
