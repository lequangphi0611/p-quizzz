import type { FastifyInstance } from 'fastify';
import { SaveAnswerBody, type AttemptView, type SubmitResponse } from '../../shared/api/index.js';
import { getAttemptView, saveAnswer, startAttempt, submitAttempt } from '../services/attempts.js';
import { fail, parseId } from './util.js';

const notFound = { error: 'Không tìm thấy lượt làm bài' };

// Member attempt routes, mounted under /api/me (behind requireParticipant, so `req.participant` is set).
// Every response is a member DTO — see shared/api/attempts.ts for the no-answer-key rule.
export async function attemptRoutes(app: FastifyInstance) {
  app.post('/attempts', async (req, reply): Promise<AttemptView | undefined> => {
    try {
      return reply.code(201).send(startAttempt(app.db, req.participant!.id));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/attempts/:id', async (req, reply): Promise<AttemptView | undefined> => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send(notFound);
    try {
      return getAttemptView(app.db, req.participant!, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put<{ Params: { id: string; questionId: string } }>('/attempts/:id/answers/:questionId', async (req, reply) => {
    const id = parseId(req.params.id);
    const questionId = parseId(req.params.questionId);
    if (!id || !questionId) return reply.code(404).send(notFound);
    const body = SaveAnswerBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
    try {
      saveAnswer(app.db, req.participant!.id, id, questionId, body.data);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post<{ Params: { id: string } }>('/attempts/:id/submit', async (req, reply): Promise<SubmitResponse | undefined> => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send(notFound);
    try {
      return submitAttempt(app.db, req.participant!.id, id);
    } catch (err) {
      return fail(reply, err);
    }
  });
}
