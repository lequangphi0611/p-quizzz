import type { FastifyPluginAsync } from 'fastify';
import { AiSuggestBody, GradeBody } from '../../../shared/api/index.js';
import type { RequestAiSuggestions, StopAiSuggestions } from '../../application/use-cases/grading/ai-suggestions.js';
import type { GetDiscussionView } from '../../application/use-cases/grading/get-discussion-view.js';
import type { GetGradingView } from '../../application/use-cases/grading/get-grading-view.js';
import type { ClearGrade, GradeAnswer } from '../../application/use-cases/grading/grade-answer.js';
import { QuestionNotFoundError } from '../../domain/grading/errors.js';
import { AnswerNotFoundError } from '../../domain/grading/errors.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';

export interface GradingUseCases {
  gradingView: GetGradingView;
  discussionView: GetDiscussionView;
  gradeAnswer: GradeAnswer;
  clearGrade: ClearGrade;
  requestAi: RequestAiSuggestions;
  stopAi: StopAiSuggestions;
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

    // "Hoàn tác": back to ungraded (PRODUCT.md §7.28).
    app.delete<{ Params: { id: string } }>('/answers/:id/grade', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new AnswerNotFoundError();
        return await uc.clearGrade.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // "AI chấm nháp" for one essay question: queues the answers and returns at once (the work runs in the background).
    app.post<{ Params: { id: string; questionId: string } }>('/sessions/:id/questions/:questionId/ai-suggest', async (req, reply) => {
      const body = AiSuggestBody.safeParse(req.body ?? undefined);
      if (!body.success) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
      try {
        const sessionId = parseId(req.params.id);
        const questionId = parseId(req.params.questionId);
        if (!sessionId) throw new SessionNotFoundError();
        if (!questionId) throw new QuestionNotFoundError();
        return await uc.requestAi.execute({ sessionId, questionId, answerIds: body.data?.answerIds });
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // "Dừng": drops what is still waiting for that question.
    app.post<{ Params: { id: string; questionId: string } }>('/sessions/:id/questions/:questionId/ai-suggest/stop', async (req, reply) => {
      try {
        const sessionId = parseId(req.params.id);
        const questionId = parseId(req.params.questionId);
        if (!sessionId) throw new SessionNotFoundError();
        if (!questionId) throw new QuestionNotFoundError();
        return await uc.stopAi.execute({ sessionId, questionId });
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
