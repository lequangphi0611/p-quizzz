import { eq } from 'drizzle-orm';
import type { AttemptView, SessionDetail } from '../../shared/api/index.js';
import { exams, options, questions } from '../infrastructure/db/schema.js';
import { createTestApp, joinAs, loginAsMentor, seedExam } from './helpers.js';

export const KEY_LEAKS = ['isCorrect', 'is_correct', 'explanation'];
// Every key at any depth of a JSON value.
export function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach(x => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}

export async function world(opts: { essay?: boolean; shuffle?: boolean; state?: 'lobby' | 'running' } = {}) {
  const { app, db } = await createTestApp();
  const headers = await loginAsMentor(app);
  const essay = opts.essay ?? false;

  const exam = seedExam(db, { hasEssay: essay });
  const qs = db.select().from(questions).where(eq(questions.examId, exam.id)).orderBy(questions.position).all();
  if (!essay) { // seedExam always adds an essay question; drop it for a multiple-choice-only exam
    db.delete(questions).where(eq(questions.id, qs[2]!.id)).run();
    db.update(exams).set({ totalPoints: 3 }).where(eq(exams.id, exam.id)).run();
  }
  const opts_ = (qid: number) => db.select().from(options).where(eq(options.questionId, qid)).orderBy(options.position).all();
  const single = { q: qs[0]!, opts: opts_(qs[0]!.id) }; // 1 point, correct = option 1
  const multi = { q: qs[1]!, opts: opts_(qs[1]!.id) }; // 2 points, correct = options 1 + 2
  const essayQ = essay ? qs[2]! : null; // 4 points

  const admin = (url: string, payload?: object) => app.inject({ method: 'POST', url: `/api/admin${url}`, headers, payload });
  const session = (await admin('/sessions', { examId: exam.id, shuffle: opts.shuffle ?? true })).json<SessionDetail>();
  await admin(`/sessions/${session.id}/open`);
  const running = (opts.state ?? 'running') === 'running';

  const join = async (name: string) => joinAs(app, session.id, name);
  const asMember = (token: string) => {
    const h = { 'x-participant-token': token };
    return {
      me: () => app.inject({ url: '/api/me', headers: h }),
      start: () => app.inject({ method: 'POST', url: '/api/me/attempts', headers: h }),
      get: (id: number) => app.inject({ url: `/api/me/attempts/${id}`, headers: h }),
      put: (id: number, qid: number, payload: unknown) => app.inject({ method: 'PUT', url: `/api/me/attempts/${id}/answers/${qid}`, headers: h, payload: payload as object }),
      submit: (id: number) => app.inject({ method: 'POST', url: `/api/me/attempts/${id}/submit`, headers: h }),
    };
  };
  // Join in the lobby (active), then start the session; later joiners are "pending".
  const first = await join('An');
  if (running) await admin(`/sessions/${session.id}/start`);
  const detail = async () => (await app.inject({ url: `/api/admin/sessions/${session.id}`, headers })).json<SessionDetail>();
  const startedAttempt = async (m: ReturnType<typeof asMember>) => (await m.start()).json<AttemptView>();
  return { app, db, headers, exam, single, multi, essayQ, session, admin, join, asMember, an: asMember(first), detail, startedAttempt };
}

