import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { buildApp } from '../app.js';
import { createDb, type Db } from '../db/client.js';
import { exams, options, questions } from '../db/schema.js';

// App + in-memory DB (already migrated) for route tests.
export async function createTestApp(opts: { adminRoutes?: FastifyPluginAsync[]; allowRemoteAdmin?: boolean; lanIps?: () => string[] } = {}) {
  const db = createDb(':memory:');
  const app = await buildApp({ db, ...opts });
  return { app, db };
}

export type ExamOverrides = Partial<typeof exams.$inferInsert>;

// Seeds one exam with a single, a multi and an essay question. Returns the exam row.
export function seedExam(db: Db, overrides: ExamOverrides = {}) {
  const exam = db
    .insert(exams)
    .values({
      title: 'Seed exam',
      sourceMarkdown: '# Seed exam',
      totalPoints: 7,
      hasEssay: true,
      createdAt: new Date(),
      ...overrides,
    })
    .returning()
    .get();

  const qs = db
    .insert(questions)
    .values([
      { examId: exam.id, position: 1, type: 'single', prompt: 'Single?', points: 1 },
      { examId: exam.id, position: 2, type: 'multi', prompt: 'Multi?', points: 2 },
      { examId: exam.id, position: 3, type: 'essay', prompt: 'Essay?', points: 4 },
    ])
    .returning()
    .all();
  const single = qs[0]!;
  const multi = qs[1]!;

  db.insert(options)
    .values([
      { questionId: single.id, position: 1, text: 'A', isCorrect: true },
      { questionId: single.id, position: 2, text: 'B' },
      { questionId: multi.id, position: 1, text: 'A', isCorrect: true },
      { questionId: multi.id, position: 2, text: 'B', isCorrect: true },
      { questionId: multi.id, position: 3, text: 'C' },
    ])
    .run();

  return exam;
}

export const TEST_PASSWORD = 'test-password';

// Sets the mentor password if needed, logs in, and returns headers carrying the auth cookie for app.inject().
export async function loginAsMentor(app: FastifyInstance): Promise<{ cookie: string }> {
  const status = (await app.inject({ method: 'GET', url: '/api/admin/status' })).json<{ setupDone: boolean }>();
  const res = await app.inject({ method: 'POST', url: status.setupDone ? '/api/admin/login' : '/api/admin/setup', payload: { password: TEST_PASSWORD } });
  const c = res.cookies.find(x => x.name === 'pq_admin');
  if (!c) throw new Error(`loginAsMentor failed: ${res.statusCode} ${res.body}`);
  return { cookie: `pq_admin=${c.value}` };
}

// Joins a session as a member and returns the participant token (works while the session is in lobby/running).
export async function joinAs(app: FastifyInstance, sessionId: number, displayName: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/join`, payload: { displayName } });
  if (res.statusCode !== 201) throw new Error(`joinAs failed: ${res.statusCode} ${res.body}`);
  return res.json<{ token: string }>().token;
}
