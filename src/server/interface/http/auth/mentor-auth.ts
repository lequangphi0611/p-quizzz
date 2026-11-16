import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticateAdmin } from '../../../application/use-cases/admin/admin-use-cases.js';

export const ADMIN_COOKIE = 'pq_admin';

// onRequest hook for every /api/admin/* route except setup, login and status.
export function requireMentor(authenticate: AuthenticateAdmin) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!authenticate.execute(req.cookies[ADMIN_COOKIE])) return reply.code(401).send({ error: 'Cần đăng nhập' });
  };
}
