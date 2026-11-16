import { and, count, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MeResponse } from '../../shared/api/index.js';
import type { ResumeParticipant } from '../application/use-cases/participants/resume-participant.js';
import { exams, participants, questions, sessions } from '../db/schema.js';
import { requireParticipant } from '../interface/http/auth/participant-auth.js';
import { toParticipantInfoDto } from '../interface/http/presenters/participant-presenter.js';
import { getMeAttemptState, getParticipantReview } from '../services/attempts.js';
import { attemptRoutes } from './attempts.js';
import { fail, parseId } from './util.js';

// Member routes under /api/me, behind requireParticipant. Moves with the attempts module (P3-3).
export const meRoutes = (resume: ResumeParticipant) =>
  async function meRoutes(app: FastifyInstance) {
    app.decorateRequest('participant', null);
    await app.register(
      async me => {
        me.addHook('onRequest', requireParticipant(resume));

        await me.register(attemptRoutes);

        me.get('/', async (req): Promise<MeResponse> => {
          const p = req.participant!;
          const s = app.db
            .select({ id: sessions.id, title: exams.title, status: sessions.status, totalPoints: exams.totalPoints, hasEssay: exams.hasEssay, examId: exams.id })
            .from(sessions)
            .innerJoin(exams, eq(sessions.examId, exams.id))
            .where(eq(sessions.id, p.sessionId))
            .get()!;
          const { n } = app.db
            .select({ n: count() })
            .from(participants)
            .where(and(eq(participants.sessionId, p.sessionId), eq(participants.status, 'active')))
            .get()!;
          const { q } = app.db.select({ q: count() }).from(questions).where(eq(questions.examId, s.examId)).get()!;
          const { examId: _examId, ...session } = s;
          return { participant: toParticipantInfoDto(p), session: { ...session, participantCount: n, questionCount: q }, attempt: getMeAttemptState(app.db, p) };
        });
      },
      { prefix: '/api/me' },
    );
  };

// Mentor route, registered inside the requireMentor scope of /api/admin: who took part and how they answered
// (the "view the session again" screen). Any session status. Moves with the attempts module (P3-3).
export const participantReviewRoutes: FastifyPluginAsync = async app => {
  app.get<{ Params: { id: string } }>('/participants/:id/review', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy người tham gia' });
    try {
      return getParticipantReview(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });
};
