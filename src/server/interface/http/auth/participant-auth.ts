import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Participant } from '../../../domain/participant/participant.js';
import type { ResumeParticipant } from '../../../application/use-cases/participants/resume-participant.js';
import { sendDomainError } from '../domain-errors.js';

export const PARTICIPANT_HEADER = 'x-participant-token';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireParticipant. */
    participant: Participant | null;
  }
}

// onRequest hook for /api/me/*: resolves the member from the X-Participant-Token header.
// Unknown token → 401, kicked member → 403.
export function requireParticipant(resume: ResumeParticipant) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers[PARTICIPANT_HEADER];
    try {
      req.participant = await resume.execute(typeof token === 'string' ? token : undefined);
    } catch (err) {
      return sendDomainError(reply, err);
    }
  };
}
