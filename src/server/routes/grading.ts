import type { FastifyInstance } from 'fastify';
import { GradeBody } from '../../shared/api/index.js';
import { getDiscussionView } from '../services/discussion.js';
import { getGradingView, gradeAnswer } from '../services/grading.js';
import { fail, parseId } from './util.js';

// Mentor-only (registered inside the requireMentor scope of /api/admin).
export async function gradingRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/sessions/:id/grading', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    try {
      return getGradingView(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  // S17: per-question statistics and anonymous essays for the projector discussion.
  app.get<{ Params: { id: string } }>('/sessions/:id/discussion', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    try {
      return getDiscussionView(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put<{ Params: { id: string } }>('/answers/:id/grade', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy bài làm' });
    const body = GradeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
    try {
      return gradeAnswer(app.db, id, body.data);
    } catch (err) {
      return fail(reply, err);
    }
  });
}
