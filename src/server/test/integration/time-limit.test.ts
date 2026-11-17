import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { ActiveSession, AttemptView, ExamSummary, MeResponse, SessionDetail } from '../../../shared/api/index.js';
import { TIME_UP_GRACE_MS } from '../../../shared/session-timer.js';
import { buildApp } from '../../app.js';
import { compose } from '../../composition.js';
import { createDb } from '../../infrastructure/db/client.js';
import { sessions } from '../../infrastructure/db/schema.js';
import { joinAs, loginAsMentor } from '../helpers.js';

// PRODUCT.md §7.27: time limit per session, default from the exam's `duration`, one shared clock, closes itself.
const MIN = 60_000;
const markdown = (duration?: string) =>
  `---\ntitle: Đề có giờ\n${duration !== undefined ? `duration: ${duration}\n` : ''}---\n\n## Câu 1\n- [x] A\n- [ ] B\n> vì A\n`;

async function setup() {
  const db = createDb(':memory:');
  const composition = compose(db);
  const app = await buildApp({ db, composition });
  const auth = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => app.inject({ method, url: `/api/admin${url}`, headers: auth, payload: payload as never });
  const importExam = async (duration?: string) => (await admin('POST', '/exams', { markdown: markdown(duration) })).json<{ exam: ExamSummary }>().exam;
  return { app, db, composition, admin, importExam };
}

describe('time limit over HTTP', () => {
  it('imports `duration` and refuses a bad one with its line', async () => {
    const { admin, importExam } = await setup();
    expect((await importExam('40')).durationMinutes).toBe(40);
    expect((await importExam()).durationMinutes).toBeNull();
    const bad = await admin('POST', '/exams', { markdown: markdown('0') });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors[0]).toMatchObject({ line: 3 });
  });

  it('creates with the exam default, accepts an override, and validates the minutes', async () => {
    const { admin, importExam } = await setup();
    const exam = await importExam('40');
    expect((await admin('POST', '/sessions', { examId: exam.id })).json<SessionDetail>()).toMatchObject({ timeLimitMinutes: 40, timer: { limitMinutes: 40, endsAt: null, remainingMs: null } });
    expect((await admin('POST', '/sessions', { examId: exam.id, timeLimitMinutes: null })).json<SessionDetail>()).toMatchObject({ timeLimitMinutes: null, timer: null });
    for (const bad of [0, 301, 1.5, '10']) expect((await admin('POST', '/sessions', { examId: exam.id, timeLimitMinutes: bad })).statusCode).toBe(400);
  });

  it('members and the projector see the minutes in the lobby, then the same countdown once started; extend moves it', async () => {
    const { app, admin, importExam } = await setup();
    const exam = await importExam();
    const { id } = (await admin('POST', '/sessions', { examId: exam.id })).json<SessionDetail>();
    expect((await admin('PUT', `/sessions/${id}/time-limit`, { timeLimitMinutes: 20 })).json<SessionDetail>().timeLimitMinutes).toBe(20);
    await admin('POST', `/sessions/${id}/open`);
    const token = await joinAs(app, id, 'An');
    const me = async () => (await app.inject({ url: '/api/me', headers: { 'x-participant-token': token } })).json<MeResponse>();
    expect((await me()).session.timer).toEqual({ limitMinutes: 20, endsAt: null, remainingMs: null });

    const started = (await admin('POST', `/sessions/${id}/start`)).json<SessionDetail>();
    expect(started.timer!.endsAt).toBe(started.startedAt! + 20 * MIN);
    expect((await admin('PUT', `/sessions/${id}/time-limit`, { timeLimitMinutes: 30 })).statusCode).toBe(409);

    const timer = (await me()).session.timer!;
    expect(timer.endsAt).toBe(started.timer!.endsAt);
    expect(timer.remainingMs).toBeGreaterThan(19 * MIN);
    expect((await app.inject({ url: `/api/sessions/${id}/public` })).json<ActiveSession>().timer?.endsAt).toBe(started.timer!.endsAt);

    const extended = (await admin('POST', `/sessions/${id}/extend-time`, { minutes: 5 })).json<SessionDetail>();
    expect(extended.timer!.endsAt).toBe(started.timer!.endsAt! + 5 * MIN);
    expect(extended.timeLimitMinutes).toBe(25);
    expect((await admin('POST', `/sessions/${id}/extend-time`, { minutes: 0 })).statusCode).toBe(400);
    expect((await admin('POST', `/sessions/${id}/extend-time`, { minutes: 61 })).statusCode).toBe(400);
  });

  it('after the deadline and grace: saving is refused, then the watcher closes the session and submits the work', async () => {
    const { app, db, composition, admin, importExam } = await setup();
    const exam = await importExam('10');
    const { id } = (await admin('POST', '/sessions', { examId: exam.id })).json<SessionDetail>();
    await admin('POST', `/sessions/${id}/open`);
    const token = await joinAs(app, id, 'An');
    await admin('POST', `/sessions/${id}/start`);
    const headers = { 'x-participant-token': token };
    const attempt = (await app.inject({ method: 'POST', url: '/api/me/attempts', headers })).json<AttemptView>();
    const q = attempt.questions[0]!;
    const save = () => app.inject({ method: 'PUT', url: `/api/me/attempts/${attempt.id}/answers/${q.id}`, headers, payload: { selectedOptionIds: [q.options[0]!.id] } });
    expect((await save()).statusCode).toBe(200);

    // Inside the grace period: still saved.
    db.update(sessions).set({ endsAt: new Date(Date.now() - TIME_UP_GRACE_MS + 2000) }).where(eq(sessions.id, id)).run();
    expect((await save()).statusCode).toBe(200);
    expect(await composition.sessions.closeExpired.execute()).toEqual([]);

    // Past it: refused, and the watcher closes the session as "Đóng" would.
    db.update(sessions).set({ endsAt: new Date(Date.now() - TIME_UP_GRACE_MS - 1000) }).where(eq(sessions.id, id)).run();
    const late = await save();
    expect(late.statusCode).toBe(409);
    expect(late.json()).toEqual({ error: 'Đã hết giờ làm bài' });
    expect(await composition.sessions.closeExpired.execute()).toEqual([id]);

    const after = (await app.inject({ url: '/api/me', headers })).json<MeResponse>();
    expect(after.session.status).toBe('finalized');
    expect(after.session.timer).toBeNull();
    expect(after.attempt.submitted).toHaveLength(1);
    const detail = (await admin('GET', `/sessions/${id}`)).json<SessionDetail>();
    expect(detail).toMatchObject({ status: 'finalized', timeLimitMinutes: 10, timer: null });
  });
});
