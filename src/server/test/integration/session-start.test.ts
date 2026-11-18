import { describe, expect, it } from 'vitest';
import type { ActiveSession, ExamSummary, MeResponse, SessionDetail } from '../../../shared/api/index.js';
import { START_COUNTDOWN_MS, START_LATE_TOLERANCE_MS } from '../../../shared/session-start.js';
import { buildApp } from '../../app.js';
import { compose } from '../../composition.js';
import { createDb } from '../../infrastructure/db/client.js';
import { FakeClock } from '../../application/testing/fakes.js';
import { joinAs, loginAsMentor } from '../helpers.js';

// PRODUCT.md §7.31: start by hand, at a scheduled time, or once everyone is ready, whichever comes first.
const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 18, 1, 0, 0);
const markdown = '---\ntitle: Đề bắt đầu\nduration: 30\n---\n\n## Câu 1\n- [x] A\n- [ ] B\n> vì A\n';

async function setup() {
  const clock = new FakeClock(T0);
  const db = createDb(':memory:');
  const composition = compose(db, { clock });
  const app = await buildApp({ db, composition });
  const auth = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => app.inject({ method, url: `/api/admin${url}`, headers: auth, payload: payload as never });
  const exam = (await admin('POST', '/exams', { markdown })).json<{ exam: ExamSummary }>().exam;
  const { id } = (await admin('POST', '/sessions', { examId: exam.id })).json<SessionDetail>();
  const detail = async () => (await admin('GET', `/sessions/${id}`)).json<SessionDetail>();
  const tick = () => composition.sessions.startDue.execute(err => { throw err; });
  const member = (token: string) => ({
    me: async () => (await app.inject({ url: '/api/me', headers: { 'x-participant-token': token } })).json<MeResponse>(),
    ready: (ready: boolean) => app.inject({ method: 'PUT', url: '/api/me/ready', headers: { 'x-participant-token': token }, payload: { ready } }),
  });
  return { app, clock, admin, id, detail, tick, member };
}

describe('session start over HTTP', () => {
  it('schedules, moves and removes the start; the watcher starts it on time and the clock runs from then', async () => {
    const { app, clock, admin, id, detail, tick, member } = await setup();
    expect((await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 - 1 })).statusCode).toBe(400);
    expect((await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 + 5 * MIN })).json<SessionDetail>().start).toMatchObject({ scheduledAt: T0 + 5 * MIN, startsInMs: 5 * MIN });
    await admin('POST', `/sessions/${id}/open`);
    const an = member(await joinAs(app, id, 'An'));
    expect((await an.me()).session.start).toMatchObject({ scheduledAt: T0 + 5 * MIN, startsAt: T0 + 5 * MIN, ready: { count: 0, total: 1 } });
    expect((await app.inject({ url: `/api/sessions/${id}/public` })).json<ActiveSession>().start).toMatchObject({ startsAt: T0 + 5 * MIN });

    expect((await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 + 10 * MIN })).json<SessionDetail>().start!.scheduledAt).toBe(T0 + 10 * MIN);
    clock.set(T0 + 10 * MIN - 1);
    expect(await tick()).toEqual([]);
    clock.set(T0 + 10 * MIN);
    expect(await tick()).toEqual([id]);
    const started = await detail();
    expect(started).toMatchObject({ status: 'running', startedAt: T0 + 10 * MIN, start: null, timer: { endsAt: T0 + 40 * MIN } });
    expect((await an.me()).participant.lateJoin).toBe(false);
    expect((await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 + 60 * MIN })).statusCode).toBe(409);
  });

  it('"Bắt đầu ngay" counts down 10 s and says it is early; the mentor can cancel it', async () => {
    const { app, clock, admin, id, detail, tick, member } = await setup();
    await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 + 5 * MIN });
    await admin('POST', `/sessions/${id}/open`);
    const an = member(await joinAs(app, id, 'An'));
    const counting = (await admin('POST', `/sessions/${id}/start-countdown`)).json<SessionDetail>();
    expect(counting.status).toBe('lobby');
    expect(counting.start).toMatchObject({ countdownSource: 'now', startsAt: T0 + START_COUNTDOWN_MS, early: true });
    expect((await an.ready(true)).statusCode).toBe(409); // locked while counting down

    expect((await admin('POST', `/sessions/${id}/cancel-countdown`)).json<SessionDetail>().start).toMatchObject({ countdownEndsAt: null, scheduledAt: T0 + 5 * MIN });
    expect((await admin('POST', `/sessions/${id}/cancel-countdown`)).statusCode).toBe(409);

    await admin('POST', `/sessions/${id}/start-countdown`);
    clock.advance(START_COUNTDOWN_MS);
    expect(await tick()).toEqual([id]);
    expect((await detail()).status).toBe('running');
  });

  it('everyone ready starts a countdown only when on, at the minimum and with nobody waiting; cancelling turns it off', async () => {
    const { app, clock, admin, id, detail, tick, member } = await setup();
    await admin('POST', `/sessions/${id}/open`);
    const an = member(await joinAs(app, id, 'An'));
    const binh = member(await joinAs(app, id, 'Bình'));
    expect((await an.ready(true)).statusCode).toBe(200);
    expect((await binh.ready(true)).statusCode).toBe(200);
    await tick();
    expect((await detail()).start!.countdownEndsAt).toBeNull(); // the option is off

    await admin('PUT', `/sessions/${id}/auto-start`, { enabled: true, minParticipants: 3 });
    await tick();
    expect((await detail()).start!.countdownEndsAt).toBeNull(); // 2 < 3
    await admin('PUT', `/sessions/${id}/auto-start`, { enabled: true, minParticipants: 2 });

    const waiting = await joinAs(app, id, 'Chi', { approve: false });
    await tick();
    expect((await detail()).start!.countdownEndsAt).toBeNull(); // Chi waits for approval
    expect((await member(waiting).ready(true)).statusCode).toBe(409);
    const chi = (await detail()).participants.find(p => p.displayName === 'Chi')!;
    await admin('POST', `/participants/${chi.id}/kick`);

    await tick();
    const d = await detail();
    expect(d.start).toMatchObject({ countdownSource: 'ready', countdownEndsAt: T0 + START_COUNTDOWN_MS, ready: { count: 2, total: 2 } });
    expect(d.participants.filter(p => p.readyAt !== null)).toHaveLength(2);
    expect((await an.me()).session.start).toMatchObject({ countdownSource: 'ready', ready: { count: 2, total: 2 } });

    // Cancelling turns the option off: everyone is still ready, yet no new countdown starts.
    expect((await admin('POST', `/sessions/${id}/cancel-countdown`)).json<SessionDetail>().start).toMatchObject({ autoStartReady: false, ready: { count: 2, total: 2 } });
    clock.advance(START_COUNTDOWN_MS);
    await tick();
    expect((await detail()).status).toBe('lobby');
  });

  it('a start missed while the server was off is dropped and remembered for the bell; late arrivals are told', async () => {
    const { app, clock, admin, id, detail, tick, member } = await setup();
    await admin('PUT', `/sessions/${id}/start-schedule`, { startsAt: T0 + MIN });
    await admin('POST', `/sessions/${id}/open`);
    const an = member(await joinAs(app, id, 'An'));
    clock.set(T0 + MIN + START_LATE_TOLERANCE_MS + 1);
    expect(await tick()).toEqual([]);
    const d = await detail();
    expect(d.status).toBe('lobby');
    expect(d.start!.scheduledAt).toBeNull();
    expect(d.startScheduleDroppedAt).toBe(T0 + MIN + START_LATE_TOLERANCE_MS + 1);

    await admin('POST', `/sessions/${id}/start`);
    const late = member(await joinAs(app, id, 'Bình', { approve: false }));
    const binh = (await detail()).participants.find(p => p.displayName === 'Bình')!;
    await admin('POST', `/participants/${binh.id}/approve`);
    expect((await an.me()).participant).toMatchObject({ lateJoin: false, ready: false });
    expect((await late.me()).participant.lateJoin).toBe(true);
  });

  it('never tells members or the public who is ready', async () => {
    const { app, admin, id, member } = await setup();
    await admin('POST', `/sessions/${id}/open`);
    const an = member(await joinAs(app, id, 'An'));
    await an.ready(true);
    const pub = (await app.inject({ url: `/api/sessions/${id}/public` })).body;
    const me = JSON.stringify(await an.me());
    for (const body of [pub, me]) expect(body).not.toMatch(/readyAt|Bình|pendingCount/);
  });
});

describe('creating a session with its start (PRODUCT.md §7.31)', () => {
  it('takes the scheduled time and "everyone ready" at creation, and refuses a time in the past without creating anything', async () => {
    const { admin } = await setup();
    const exam = (await admin('GET', '/exams')).json<ExamSummary[]>()[0]!;
    const before = (await admin('GET', '/sessions')).json<unknown[]>().length;
    expect((await admin('POST', '/sessions', { examId: exam.id, startsAt: T0 - 1 })).statusCode).toBe(400);
    expect((await admin('GET', '/sessions')).json<unknown[]>()).toHaveLength(before);

    const made = (await admin('POST', '/sessions', { examId: exam.id, startsAt: T0 + 30 * MIN, autoStart: { enabled: true, minParticipants: 4 } })).json<SessionDetail>();
    expect(made).toMatchObject({ status: 'draft', start: { scheduledAt: T0 + 30 * MIN, autoStartReady: true, readyMin: 4 } });
    expect((await admin('POST', '/sessions', { examId: exam.id, autoStart: { enabled: true, minParticipants: 0 } })).statusCode).toBe(400);
  });
});
