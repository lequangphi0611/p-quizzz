import { describe, expect, it } from 'vitest';
import type { ActiveSession, SessionDetail, SessionSummary } from '../../../shared/api/index.js';
import type { SessionAction } from '../../../shared/session-state.js';
import { participants } from '../../infrastructure/db/schema.js';
import { bus } from '../../infrastructure/events/event-bus.js';
import { createTestApp, loginAsMentor, seedExam } from '../helpers.js';

async function setup() {
  const { app, db } = await createTestApp();
  const headers = await loginAsMentor(app);
  const create = async (examId: number, payload: object = {}) => app.inject({ method: 'POST', url: '/api/admin/sessions', headers, payload: { examId, ...payload } });
  const act = (id: number, action: string) => app.inject({ method: 'POST', url: `/api/admin/sessions/${id}/${action}`, headers });
  const get = async (id: number) => (await app.inject({ url: `/api/admin/sessions/${id}`, headers })).json<SessionDetail>();
  const newSession = async (examId: number) => (await create(examId)).json<SessionDetail>();
  return { app, db, headers, create, act, get, newSession };
}

describe('sessions — auth', () => {
  it('admin routes are 401 without the mentor cookie; the public session view is open', async () => {
    const { app } = await createTestApp();
    for (const [method, url] of [['POST', '/api/admin/sessions'], ['GET', '/api/admin/sessions'], ['GET', '/api/admin/sessions/1'], ['POST', '/api/admin/sessions/1/open']] as const) {
      expect((await app.inject({ method, url })).statusCode, url).toBe(401);
    }
    expect((await app.inject({ url: '/api/sessions/1/public' })).statusCode).toBe(404); // reachable, just unknown
    expect((await app.inject({ url: '/api/admin/events' })).statusCode).toBe(401);
  });
});

describe('POST /sessions', () => {
  it('creates a draft self_paced session with shuffle on by default', async () => {
    const { db, create } = await setup();
    const exam = seedExam(db, { title: 'Đề A' });
    const res = await create(exam.id);
    expect(res.statusCode).toBe(201);
    expect(res.json<SessionDetail>()).toMatchObject({
      examId: exam.id, examTitle: 'Đề A', mode: 'self_paced', status: 'draft', shuffle: true,
      openedAt: null, startedAt: null, closedAt: null, finalizedAt: null, participantCount: 0, participants: [],
      exam: { id: exam.id, title: 'Đề A', hasEssay: true, totalPoints: 7 },
    });
    expect((await create(exam.id, { shuffle: false })).json<SessionDetail>().shuffle).toBe(false);
  });

  it('404 for an unknown exam, 400 for a bad body', async () => {
    const { create, app, headers } = await setup();
    const res = await create(999);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Không tìm thấy đề' });
    for (const payload of [{}, { examId: 'x' }, { examId: 0 }, { examId: 1.5 }, { examId: 1, shuffle: 'yes' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/sessions', headers, payload })).statusCode, JSON.stringify(payload)).toBe(400);
    }
  });
});

describe('lifecycle', () => {
  it('multiple-choice exam: draft → lobby → running → closed closes straight to finalized', async () => {
    const { db, newSession, act, get } = await setup();
    const exam = seedExam(db, { hasEssay: false });
    const { id } = await newSession(exam.id);

    expect((await act(id, 'open')).json<SessionDetail>().status).toBe('lobby');
    expect((await act(id, 'start')).json<SessionDetail>().status).toBe('running');
    const closed = (await act(id, 'close')).json<SessionDetail>();
    expect(closed.status).toBe('finalized');
    expect(closed.closedAt).not.toBeNull();
    expect(closed.finalizedAt).not.toBeNull();
    expect((await get(id)).status).toBe('finalized');
  });

  it('exam with essays: stops at closed until finalize', async () => {
    const { db, newSession, act } = await setup();
    const exam = seedExam(db, { hasEssay: true });
    const { id } = await newSession(exam.id);
    await act(id, 'open');
    await act(id, 'start');
    const closed = (await act(id, 'close')).json<SessionDetail>();
    expect(closed.status).toBe('closed');
    expect(closed.finalizedAt).toBeNull();

    const finalized = (await act(id, 'finalize')).json<SessionDetail>();
    expect(finalized.status).toBe('finalized');
    expect(finalized.finalizedAt).not.toBeNull();
  });

  it('stamps each timestamp at the right step and no earlier', async () => {
    const { db, newSession, act, get } = await setup();
    const { id } = await newSession(seedExam(db, { hasEssay: true }).id);
    const stamps = async () => { const s = await get(id); return [s.openedAt, s.startedAt, s.closedAt, s.finalizedAt].map(v => v !== null); };

    expect(await stamps()).toEqual([false, false, false, false]);
    await act(id, 'open');
    expect(await stamps()).toEqual([true, false, false, false]);
    await act(id, 'start');
    expect(await stamps()).toEqual([true, true, false, false]);
    await act(id, 'close');
    expect(await stamps()).toEqual([true, true, true, false]);
    await act(id, 'finalize');
    expect(await stamps()).toEqual([true, true, true, true]);
    const s = await get(id);
    expect(s.createdAt).toBeLessThanOrEqual(s.openedAt!);
    expect(s.openedAt!).toBeLessThanOrEqual(s.startedAt!);
    expect(s.startedAt!).toBeLessThanOrEqual(s.closedAt!);
    expect(s.closedAt!).toBeLessThanOrEqual(s.finalizedAt!);
  });

  it('out-of-order actions → 409 naming the current status, and nothing changes', async () => {
    const { db, newSession, act, get } = await setup();
    const { id } = await newSession(seedExam(db).id);

    const cases: [string, SessionAction, string][] = [
      ['draft', 'start', 'Không thể bắt đầu thi khi phiên đang ở trạng thái "Nháp"'],
      ['draft', 'close', 'Không thể đóng phiên khi phiên đang ở trạng thái "Nháp"'],
      ['draft', 'finalize', 'Không thể chốt kết quả khi phiên đang ở trạng thái "Nháp"'],
    ];
    for (const [, action, msg] of cases) {
      const res = await act(id, action);
      expect(res.statusCode, action).toBe(409);
      expect(res.json()).toEqual({ error: msg });
    }

    await act(id, 'open');
    const again = await act(id, 'open');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'Không thể mở phòng chờ khi phiên đang ở trạng thái "Phòng chờ"' });
    expect((await act(id, 'close')).statusCode).toBe(409);
    expect((await act(id, 'finalize')).statusCode).toBe(409);
    expect((await get(id)).status).toBe('lobby');
  });

  it('a finalized session accepts no further action', async () => {
    const { db, newSession, act } = await setup();
    const { id } = await newSession(seedExam(db, { hasEssay: false }).id);
    for (const a of ['open', 'start', 'close']) await act(id, a);
    for (const a of ['open', 'start', 'close', 'finalize']) expect((await act(id, a)).statusCode, a).toBe(409);
  });

  it('404 for an unknown session, an unknown action or a malformed id', async () => {
    const { act, app, headers } = await setup();
    expect((await act(999, 'open')).statusCode).toBe(404);
    expect((await act(1, 'explode')).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/admin/sessions/abc', headers })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/admin/sessions/999', headers })).statusCode).toBe(404);
  });
});

describe('parallel sessions (PRODUCT.md §7.5)', () => {
  it('several sessions can be open at once: own code and slot each, started and closed independently', async () => {
    const { db, newSession, act, get } = await setup();
    const exam = seedExam(db, { hasEssay: false });
    const [a, b, c] = [await newSession(exam.id), await newSession(exam.id), await newSession(exam.id)];

    for (const x of [a, b, c]) expect((await act(x.id, 'open')).statusCode).toBe(200);
    const [sa, sb, sc] = [await get(a.id), await get(b.id), await get(c.id)];
    expect([sa.slot, sb.slot, sc.slot]).toEqual([1, 2, 3]);
    expect(new Set([sa.roomCode, sb.roomCode, sc.roomCode]).size).toBe(3);

    await act(a.id, 'start');
    expect((await get(b.id)).status).toBe('lobby'); // untouched
    for (const x of ['start', 'close']) await act(b.id, x);
    expect((await get(b.id)).slot).toBeNull(); // closing frees the slot
    expect((await get(c.id)).slot).toBe(3);
  });

  it('?active=true lists only sessions in lobby/running, lowest slot first', async () => {
    const { app, headers, db, newSession, act } = await setup();
    const exam = seedExam(db, { hasEssay: false });
    const [a, b, c] = [await newSession(exam.id), await newSession(exam.id), await newSession(exam.id)];
    await act(c.id, 'open');
    await act(a.id, 'open');
    void b; // stays a draft: not listed as active
    const active = (await app.inject({ url: '/api/admin/sessions?active=true', headers })).json<SessionSummary[]>();
    expect(active.map(s => [s.id, s.slot])).toEqual([[c.id, 1], [a.id, 2]]);
    const all = (await app.inject({ url: '/api/admin/sessions', headers })).json<SessionSummary[]>();
    expect(all).toHaveLength(3);
  });

  it('the name is the mentor\'s label: default "<exam> – dd/MM", trimmed when typed, too long is refused', async () => {
    const { db, create } = await setup();
    const exam = seedExam(db, { title: 'Đề Git' });
    expect((await create(exam.id)).json<SessionDetail>().name).toMatch(/^Đề Git – \d{2}\/\d{2}$/);
    expect((await create(exam.id, { name: '  Lớp 0908  ' })).json<SessionDetail>().name).toBe('Lớp 0908');
    expect((await create(exam.id, { name: 'x'.repeat(81) })).statusCode).toBe(400);
  });
});

describe('GET /api/sessions/:id/public', () => {
  it('shows the exam title and status only: never the session name, room code or slot', async () => {
    const { app, db, create, act } = await setup();
    const exam = seedExam(db, { title: 'Đề Git', hasEssay: false });
    const { id } = (await create(exam.id, { name: '#member-0908' })).json<SessionDetail>();
    const pub = async () => app.inject({ url: `/api/sessions/${id}/public` });

    expect((await pub()).json<ActiveSession>()).toEqual({ id, title: 'Đề Git', status: 'draft' });
    await act(id, 'open');
    const res = await pub();
    expect(res.json<ActiveSession>()).toEqual({ id, title: 'Đề Git', status: 'lobby' });
    expect(res.body).not.toMatch(/member-0908|roomCode|slot|name/);
    for (const x of ['start', 'close']) await act(id, x);
    expect((await pub()).json<ActiveSession>().status).toBe('finalized');
  });

  it('404 for an unknown or malformed id; open to LAN machines', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/sessions/999/public' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/sessions/abc/public' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/sessions/999/public', remoteAddress: '192.168.1.50' })).statusCode).toBe(404); // not 403
  });
});

describe('GET /sessions', () => {
  it('lists newest first with exam title and active participant count', async () => {
    const { app, db, headers, newSession } = await setup();
    const first = await newSession(seedExam(db, { title: 'Một' }).id);
    const second = await newSession(seedExam(db, { title: 'Hai' }).id);
    db.insert(participants)
      .values([
        { sessionId: first.id, displayName: 'An', token: 't1', status: 'active', joinedAt: new Date() },
        { sessionId: first.id, displayName: 'Bình', token: 't2', status: 'pending', joinedAt: new Date() },
        { sessionId: first.id, displayName: 'Chi', token: 't3', status: 'kicked', joinedAt: new Date() },
      ])
      .run();

    const list = (await app.inject({ url: '/api/admin/sessions', headers })).json<SessionSummary[]>();
    expect(list.map(s => [s.id, s.examTitle, s.participantCount])).toEqual([[second.id, 'Hai', 0], [first.id, 'Một', 1]]);
    expect(Object.keys(list[0]!)).not.toContain('participants');
  });

  it('detail includes the participants of that session only', async () => {
    const { db, get, newSession } = await setup();
    const exam = seedExam(db);
    const a = await newSession(exam.id);
    const b = await newSession(exam.id);
    db.insert(participants).values([
      { sessionId: a.id, displayName: 'An', token: 'ta', status: 'active', joinedAt: new Date() },
      { sessionId: b.id, displayName: 'Bình', token: 'tb', status: 'pending', joinedAt: new Date() },
    ]).run();
    expect((await get(a.id)).participants).toEqual([{ id: expect.any(Number), displayName: 'An', status: 'active', joinedAt: expect.any(Number), progress: { state: 'none', attempts: 0, countedScore: null, maxScore: 7, submittedAt: null, editRequest: null } }]);
  });
});

describe('realtime signal', () => {
  it('publishes a "session" event on every transition, and none when the action is rejected', async () => {
    const { db, newSession, act } = await setup();
    const { id } = await newSession(seedExam(db, { hasEssay: true }).id);
    const events: string[] = [];
    const off = bus.subscribe(id, t => events.push(t));

    await act(id, 'start'); // invalid from draft
    expect(events).toEqual([]);
    for (const a of ['open', 'start', 'close', 'finalize']) await act(id, a);
    off();
    expect(events).toEqual(['session', 'session', 'session', 'session']);
  });
});
