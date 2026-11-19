import type { FastifyReply } from 'fastify';
import { DomainError, type DomainErrorKind } from '../../domain/errors.js';

const STATUS: Record<DomainErrorKind, 400 | 401 | 403 | 404 | 409> = {
  invalid: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

/** Sends a business failure as `{ error }` with its status. Anything else is a real bug and is rethrown. */
export function sendDomainError(reply: FastifyReply, err: unknown) {
  if (err instanceof DomainError) return reply.code(STATUS[err.kind]).send({ ...err.details, error: err.message, ...(err.code ? { code: err.code } : {}) });
  throw err;
}
