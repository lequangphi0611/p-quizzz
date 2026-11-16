import type { FastifyPluginAsync } from 'fastify';
import { GradeBody } from '../../../shared/api/index.js';
import type { GetDiscussionView } from '../../application/use-cases/grading/get-discussion-view.js';
import type { GetGradingView } from '../../application/use-cases/grading/get-grading-view.js';
import type { GradeAnswer } from '../../application/use-cases/grading/grade-answer.js';
import { AnswerNotFoundError } from '../../domain/grading/errors.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';

export interface GradingUseCases {
  gradingView: GetGradingView;
  discussionView: GetDiscussionView;
  gradeAnswer: GradeAnswer;
}

// Mentor-only (registered inside the requireMentor scope of /api/admin).
export const gradingRoutes = (uc: GradingUseCases): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/sessions/:id/grading', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.gradingView.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Per-question statistics and anonymous essays for the projector discussion.
    app.get<{ Params: { id: string } }>('/sessions/:id/discussion', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.discussionView.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.put<{ Params: { id: string } }>('/answers/:id/grade', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return sendDomainError(reply, new AnswerNotFoundError());
      const body = GradeBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        return await uc.gradeAnswer.execute({ answerId: id, ...body.data });
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
