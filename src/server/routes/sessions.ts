import type { FastifyInstance } from 'fastify';
import { CreateSessionBody, type ActiveSession } from '../../shared/api/index.js';
import { SESSION_ACTIONS, type SessionAction } from '../../shared/session-state.js';
import { createSession, getActiveSession, getLatestSession, getSessionDetail, listSessions, transitionSession } from '../services/sessions.js';
import { fail, parseId } from './util.js';

// Mentor session routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
export async function sessionsRoutes(app: FastifyInstance) {
  app.post('/sessions', async (req, reply) => {
    const body = CreateSessionBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
    try {
      return reply.code(201).send(createSession(app.db, body.data));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/sessions', async () => listSessions(app.db));

  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const id = parseId(req.params.id);
    if (!id) return reply.code(404).send({ error: 'Không tìm thấy phiên' });
    try {
      return getSessionDetail(app.db, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post<{ Params: { id: string; action: string } }>('/sessions/:id/:action', async (req, reply) => {
    const id = parseId(req.params.id);
    const action = req.params.action as SessionAction;
    if (!id || !SESSION_ACTIONS.includes(action)) return reply.code(404).send({ error: 'Không tìm thấy' });
    try {
      return transitionSession(app.db, id, action);
    } catch (err) {
      return fail(reply, err);
    }
  });
}

// Public: lets members find the room from the root URL.
export async function publicSessionsRoutes(app: FastifyInstance) {
  app.get('/api/sessions/active', async (_req, reply) => reply.send(getActiveSession(app.db) satisfies ActiveSession | null));
  // The projector follows the active session, or else the one that just ended.
  app.get('/api/sessions/latest', async (_req, reply) => reply.send(getLatestSession(app.db) satisfies ActiveSession | null));
}
