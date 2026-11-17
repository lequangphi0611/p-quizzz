import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { buildApp } from '../app.js';
import { compose, type AiOptions } from '../composition.js';
import type { JoinLimiter } from '../interface/http/join-limiter.js';
import { createDb, type Db } from '../infrastructure/db/client.js';
import { eq } from 'drizzle-orm';
import { exams, options, participants, questions, sessions } from '../infrastructure/db/schema.js';

// App + in-memory DB (already migrated) for route tests.
// Tests never reach the mentor's real AI command: without `ai`, the grader points at a config file that does not exist.
export const NO_AI_CONFIG = 'config/__tests_have_no_ai__.json';

export async function createTestApp({ ai, ...opts }: { adminRoutes?: FastifyPluginAsync[]; allowRemoteAdmin?: boolean; lanIps?: () => string[]; joinLimiter?: JoinLimiter; ai?: AiOptions } = {}) {
  const db = createDb(':memory:');
  const composition = compose(db, {}, ai ?? { configPath: NO_AI_CONFIG });
  const app = await buildApp({ db, composition, ...opts });
  return { app, db, composition };
}

export { seedExam, type ExamOverrides } from '../infrastructure/db/testing/seed-exam.js';

export const TEST_PASSWORD = 'test-password';

// Sets the mentor password if needed, logs in, and returns headers carrying the auth cookie for app.inject().
export async function loginAsMentor(app: FastifyInstance): Promise<{ cookie: string }> {
  const status = (await app.inject({ method: 'GET', url: '/api/admin/status' })).json<{ setupDone: boolean }>();
  const res = await app.inject({ method: 'POST', url: status.setupDone ? '/api/admin/login' : '/api/admin/setup', payload: { password: TEST_PASSWORD } });
  const c = res.cookies.find(x => x.name === 'pq_admin');
  if (!c) throw new Error(`loginAsMentor failed: ${res.statusCode} ${res.body}`);
  return { cookie: `pq_admin=${c.value}` };
}

// The room code of a session (what the mentor shows members). Tests read it from the DB.
export function roomCodeOf(app: FastifyInstance, sessionId: number): string {
  const row = app.db.select({ code: sessions.roomCode }).from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!row?.code) throw new Error(`session ${sessionId} has no room code yet (is it opened?)`);
  return row.code;
}

// Joins a session as a member and returns the participant token (works while the session is in lobby/running).
// Everyone joins as `pending`. In the lobby this helper plays the mentor and lets them in straight away (what most tests
// want); once the session runs, latecomers stay pending, as in production. Pass `approve: false` to keep them pending.
export async function joinAs(app: FastifyInstance, sessionId: number, displayName: string, opts: { approve?: boolean } = {}): Promise<string> {
  const res = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/join`, payload: { displayName, roomCode: roomCodeOf(app, sessionId) } });
  if (res.statusCode !== 201) throw new Error(`joinAs failed: ${res.statusCode} ${res.body}`);
  const { token } = res.json<{ token: string }>();
  const lobby = app.db.select({ s: sessions.status }).from(sessions).where(eq(sessions.id, sessionId)).get()?.s === 'lobby';
  if (lobby && opts.approve !== false) app.db.update(participants).set({ status: 'active' }).where(eq(participants.token, token)).run();
  return token;
}
