import type { FastifyInstance } from 'fastify';
import { buildLeaderboard } from '../services/leaderboard.js';
import { fail, parseId } from './util.js';

// GET /api/sessions/:id/leaderboard — public, read-only. Realtime clients refetch it on the `leaderboard` SSE event.
export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/sessions/:id/leaderboard', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    try {
      return buildLeaderboard(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });
}
