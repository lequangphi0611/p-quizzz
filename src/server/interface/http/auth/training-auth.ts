import type { FastifyReply, FastifyRequest } from 'fastify';
import { TRAINING_MEMBER_HEADER } from '../../../../shared/api/training.js';
import type { TrainingMemberContext, ResumeTrainingMember } from '../../../application/use-cases/training/member.js';
import { sendDomainError } from '../domain-errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireTrainingMember. */
    trainingMember: TrainingMemberContext | null;
  }
}

// onRequest hook for /api/training/me*: resolves the member from the X-Training-Member-Token header. Unknown token → 401.
export function requireTrainingMember(resume: ResumeTrainingMember) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers[TRAINING_MEMBER_HEADER];
    try {
      req.trainingMember = await resume.execute(typeof token === 'string' ? token : undefined);
    } catch (err) {
      return sendDomainError(reply, err);
    }
  };
}
