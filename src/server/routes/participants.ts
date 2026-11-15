import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { DisplayNameBody, type MeResponse } from '../../shared/api/index.js';
import { requireParticipant } from '../auth/participant.js';
import { exams, sessions } from '../db/schema.js';
import { approveParticipant, joinSession, kickParticipant, renameParticipant, toParticipantInfo } from '../services/participants.js';
import { fail, parseId } from './util.js';

const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Public: a member joins the active session by typing a name.
export async function joinRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/api/sessions/:id/join', async (req, reply) => {
    const sessionId = parseId(req.params.id);
    if (!sessionId) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    const body = DisplayNameBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
    try {
      return reply.code(201).send(joinSession(app.db, sessionId, body.data.displayName));
    } catch (err) {
      return fail(reply, err);
    }
  });
}

// Member routes under /api/me, behind requireParticipant. S11 adds /attempts here.
export async function meRoutes(app: FastifyInstance) {
  app.decorateRequest('participant', null);
  await app.register(
    async me => {
      me.addHook('onRequest', requireParticipant(app.db));

      me.get('/', async (req): Promise<MeResponse> => {
        const p = req.participant!;
        const s = app.db
          .select({ id: sessions.id, title: exams.title, status: sessions.status })
          .from(sessions)
          .innerJoin(exams, eq(sessions.examId, exams.id))
          .where(eq(sessions.id, p.sessionId))
          .get()!;
        return { participant: toParticipantInfo(p), session: s, attempt: null };
      });
    },
    { prefix: '/api/me' },
  );
}

// Mentor routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
export async function participantsRoutes(app: FastifyInstance) {
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
