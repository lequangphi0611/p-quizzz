import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.js';
import { participants } from '../db/schema.js';

export const PARTICIPANT_HEADER = 'x-participant-token';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireParticipant. */
    participant: typeof participants.$inferSelect | null;
  }
}

// onRequest hook for /api/me/*: resolves the member from the X-Participant-Token header.
export function requireParticipant(db: Db) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers[PARTICIPANT_HEADER];
    const p = typeof token === 'string' && token ? db.select().from(participants).where(eq(participants.token, token)).get() : undefined;
    if (!p) return reply.code(401).send({ error: 'Bạn chưa vào phiên thi' });
    if (p.status === 'kicked') return reply.code(403).send({ error: 'Bạn đã bị mời ra khỏi phiên' });
    req.participant = p;
  };
}
