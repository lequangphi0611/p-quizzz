import { and, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { DisplayNameBody, JoinBody, type MeResponse, type PublicParticipant } from '../../shared/api/index.js';
import { createJoinLimiter, type JoinLimiter } from '../auth/join-limiter.js';
import { ServiceError } from '../services/errors.js';
import { requireParticipant } from '../auth/participant.js';
import { exams, participants, questions, sessions } from '../db/schema.js';
import { approveParticipant, joinSession, kickParticipant, renameParticipant, toParticipantInfo } from '../services/participants.js';
import { getMeAttemptState, getParticipantReview } from '../services/attempts.js';
import { attemptRoutes } from './attempts.js';
import { fail, parseId } from './util.js';

const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Public: a member joins the active session with its room code and a name.
export async function joinRoutes(app: FastifyInstance, opts: { limiter?: JoinLimiter } = {}) {
  const limiter = opts.limiter ?? createJoinLimiter();
  app.post<{ Params: { id: string } }>('/api/sessions/:id/join', async (req, reply) => {
    // Guessing the 6-digit code is slowed down per client address (req.ip is the socket peer, see buildApp).
    const wait = limiter.retryAfter(req.ip);
    if (wait > 0) return reply.code(429).header('Retry-After', String(wait)).send({ error: `Nhập sai mã phòng quá nhiều lần. Thử lại sau ${wait} giây` });

    const sessionId = parseId(req.params.id);
    if (!sessionId) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    const body = JoinBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
    try {
      return reply.code(201).send(joinSession(app.db, sessionId, body.data.displayName, body.data.roomCode));
    } catch (err) {
      if (err instanceof ServiceError && err.status === 403) limiter.fail(req.ip);
      return fail(reply, err);
    }
  });
}

// Public list for the projector: who is in the room. Only `active` members, only their names, in join order.
export async function publicParticipantsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/sessions/:id/participants', async (req, reply): Promise<PublicParticipant[] | undefined> => {
    const id = parseId(req.params.id);
    if (!id || !app.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id)).get()) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    return app.db
      .select({ displayName: participants.displayName })
      .from(participants)
      .where(and(eq(participants.sessionId, id), eq(participants.status, 'active')))
      .orderBy(participants.joinedAt, participants.id)
      .all();
  });
}

// Member routes under /api/me, behind requireParticipant.
export async function meRoutes(app: FastifyInstance) {
  app.decorateRequest('participant', null);
  await app.register(
    async me => {
      me.addHook('onRequest', requireParticipant(app.db));

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
        return { participant: toParticipantInfo(p), session: { ...session, participantCount: n, questionCount: q }, attempt: getMeAttemptState(app.db, p) };
      });
    },
    { prefix: '/api/me' },
  );
}

// Mentor routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
export async function participantsRoutes(app: FastifyInstance) {
  // Who took part and how they answered (the "view the session again" screen). Any session status.
  app.get<{ Params: { id: string } }>('/participants/:id/review', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy người tham gia' });
    try {
      return getParticipantReview(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch<{ Params: { id: string } }>('/participants/:id', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy người tham gia' });
    const body = DisplayNameBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
    try {
      return renameParticipant(app.db, id, body.data.displayName);
    } catch (err) {
      return fail(reply, err);
    }
  });

  for (const [action, run] of [['kick', kickParticipant], ['approve', approveParticipant]] as const) {
    app.post<{ Params: { id: string } }>(`/participants/:id/${action}`, async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: 'Không tìm thấy người tham gia' });
      try {
        return run(app.db, id);
      } catch (err) {
        return fail(reply, err);
      }
    });
  }
}
