import type { FastifyReply } from 'fastify';
import { ServiceError } from '../services/errors.js';

export const parseId = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Maps service errors to `{ error }` responses; anything else is a real bug and is rethrown.
export function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ServiceError) return reply.code(err.status).send({ error: err.message });
  throw err;
}
