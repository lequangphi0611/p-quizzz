import { describe, expect, it } from 'vitest';
import type { ActiveSession, LeaderboardResponse, MeResponse, NetworkInfo, PublicParticipant, SessionDetail, SessionSummary } from '../../shared/api/index.js';
import { createJoinLimiter } from '../auth/join-limiter.js';
import { createTestApp, loginAsMentor, roomCodeOf, seedExam } from '../test/helpers.js';

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const { app, db } = await createTestApp(opts);
  const headers = await loginAsMentor(app);
  const exam = seedExam(db, { hasEssay: false });
  const admin = (url: string, payload?: object) => app.inject({ method: 'POST', url: `/api/admin${url}`, headers, payload });
  const create = async () => (await admin('/sessions', { examId: exam.id })).json<SessionDetail>();
  const detail = async (id: number) => (await app.inject({ url: `/api/admin/sessions/${id}`, headers })).json<SessionDetail>();
  const join = (sessionId: number, body: unknown, remoteAddress = '192.168.1.50') => app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/join`, payload: body as object, remoteAddress });
  return { app, db, headers, exam, admin, create, detail, join };
}

describe('room code lifecycle', () => {
  it('a draft has no code; opening gives a 6-digit code that the mentor can see and that stays afterwards', async () => {
    const s = await setup();
    const sess = await s.create();
    expect(sess.roomCode).toBeNull();
    const opened = (await s.admin(`/sessions/${sess.id}/open`)).json<SessionDetail>();
    expect(opened.roomCode).toMatch(/^\d{6}$/);
    await s.admin(`/sessions/${sess.id}/start`);
    await s.admin(`/sessions/${sess.id}/close`);
    expect((await s.detail(sess.id)).roomCode).toBe(opened.roomCode); // kept for the history view
    const list = (await s.app.inject({ url: '/api/admin/sessions', headers: s.headers })).json<SessionSummary[]>();
    expect(list[0]!.roomCode).toBe(opened.roomCode);
  });

  it('every session gets its own code, so an old link cannot reach a newer session', async () => {
    const s = await setup();
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const sess = await s.create();
      codes.push((await s.admin(`/sessions/${sess.id}/open`)).json<SessionDetail>().roomCode!);
      await s.admin(`/sessions/${sess.id}/start`);
      await s.admin(`/sessions/${sess.id}/close`);
    }
    expect(new Set(codes).size).toBe(5);
  });

  it('the previous session\'s code does not work in the next one', async () => {
    const s = await setup();
    const first = await s.create();
    const oldCode = (await s.admin(`/sessions/${first.id}/open`)).json<SessionDetail>().roomCode!;
    await s.admin(`/sessions/${first.id}/start`);
    await s.admin(`/sessions/${first.id}/close`);
    const second = await s.create();
    await s.admin(`/sessions/${second.id}/open`);
    const res = await s.join(second.id, { displayName: 'An', roomCode: oldCode });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Mã phòng không đúng' });
  });

  it('a token from the previous session stays bound to it: it cannot see, join or take the next session', async () => {
    const s = await setup();
    const first = await s.create();
    const code1 = (await s.admin(`/sessions/${first.id}/open`)).json<SessionDetail>().roomCode!;
    const { token } = (await s.join(first.id, { displayName: 'An', roomCode: code1 })).json<{ token: string }>();
    await s.admin(`/sessions/${first.id}/start`);
    await s.admin(`/sessions/${first.id}/close`);
    const second = await s.create();
    await s.admin(`/sessions/${second.id}/open`);
    await s.admin(`/sessions/${second.id}/start`);
    const asOld = (method: 'GET' | 'POST', url: string) => s.app.inject({ method, url, headers: { 'x-participant-token': token } });
    // /api/me still answers about the old, closed session (so the old result can be shown), never the new one.
    const me = (await asOld('GET', '/api/me')).json<MeResponse>();
    expect(me.session.id).toBe(first.id);
    expect(me.session.status).toBe('finalized'); // multiple-choice only → auto-finalized on close
    // Starting an attempt with the old token targets the closed session → refused; nothing is created in the new one.
    expect((await asOld('POST', '/api/me/attempts')).statusCode).toBe(409);
    const people = (await s.app.inject({ url: `/api/sessions/${second.id}/participants` })).json<PublicParticipant[]>();
    expect(people).toEqual([]);
  });
});

describe('POST /api/sessions/:id/join — the room code', () => {
  it('needs the right code: correct → 201, wrong → 403, missing or malformed → 400', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    const wrong = code === '000000' ? '111111' : '000000';

    expect((await s.join(sess.id, { displayName: 'An', roomCode: wrong })).json()).toEqual({ error: 'Mã phòng không đúng' });
    expect((await s.join(sess.id, { displayName: 'An', roomCode: wrong })).statusCode).toBe(403);
    for (const body of [{ displayName: 'An' }, { displayName: 'An', roomCode: '' }, { displayName: 'An', roomCode: '12345' }, { displayName: 'An', roomCode: 'abcdef' }, { displayName: 'An', roomCode: 123456 }]) {
      expect((await s.join(sess.id, body)).statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await s.join(sess.id, { displayName: 'An', roomCode: code })).statusCode).toBe(201);
  });

  it('accepts the code with spaces or dashes (as read aloud or pasted)', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect((await s.join(sess.id, { displayName: 'An', roomCode: spaced })).statusCode).toBe(201);
    expect((await s.join(sess.id, { displayName: 'Bình', roomCode: `${code.slice(0, 3)}-${code.slice(3)}` })).statusCode).toBe(201);
  });

  it('a late joiner (session running) needs the code too', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    await s.admin(`/sessions/${sess.id}/start`);
    expect((await s.join(sess.id, { displayName: 'Trễ', roomCode: '000000' })).statusCode).toBe(403);
    expect((await s.join(sess.id, { displayName: 'Trễ', roomCode: roomCodeOf(s.app, sess.id) })).statusCode).toBe(201);
  });

  it('a session that is not open says so, whatever code is sent', async () => {
    const s = await setup();
    const sess = await s.create();
    expect((await s.join(sess.id, { displayName: 'An', roomCode: '123456' })).json()).toEqual({ error: 'Phiên thi không mở' });
  });

  it('a wrong code does not create anyone, and the name stays free', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    await s.join(sess.id, { displayName: 'An', roomCode: '000000' });
    expect((await s.detail(sess.id)).participants).toEqual([]);
  });
});

describe('guessing the code is throttled per address', () => {
  const guess = (s: Awaited<ReturnType<typeof setup>>, id: number, ip: string, code = '000000') => s.join(id, { displayName: 'X', roomCode: code }, ip);

  it('5 wrong codes, then 429 with Retry-After — even for the right code', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const real = roomCodeOf(s.app, sess.id);
    const wrong = real === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) expect((await guess(s, sess.id, '192.168.1.60', wrong)).statusCode).toBe(403);
    const blocked = await guess(s, sess.id, '192.168.1.60', real);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ error: string }>().error).toMatch(/Thử lại sau \d+ giây/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('another address is unaffected, so one noisy device cannot lock the room', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const real = roomCodeOf(s.app, sess.id);
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 6; i++) await guess(s, sess.id, '192.168.1.60', wrong);
    expect((await s.join(sess.id, { displayName: 'An', roomCode: real }, '192.168.1.61')).statusCode).toBe(201);
  });

  it('malformed codes (400) and an unopened session (409) do not count as guesses', async () => {
    const s = await setup();
    const sess = await s.create();
    for (let i = 0; i < 10; i++) await s.join(sess.id, { displayName: 'X', roomCode: 'abc' }, '192.168.1.62');
    await s.admin(`/sessions/${sess.id}/open`);
    expect((await s.join(sess.id, { displayName: 'An', roomCode: roomCodeOf(s.app, sess.id) }, '192.168.1.62')).statusCode).toBe(201);
  });

  it('the block lifts when the window has passed', async () => {
    let t = 0;
    const s = await setup({ joinLimiter: createJoinLimiter({ now: () => t }) });
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const real = roomCodeOf(s.app, sess.id);
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await guess(s, sess.id, '192.168.1.63', wrong);
    expect((await guess(s, sess.id, '192.168.1.63', real)).statusCode).toBe(429);
    t += 61_000;
    expect((await s.join(sess.id, { displayName: 'An', roomCode: real }, '192.168.1.63')).statusCode).toBe(201);
  });
});

describe('the code never leaks through public endpoints', () => {
  it('is absent from active, latest, participants, leaderboard, network, /api/me and the join response', async () => {
    const s = await setup({ lanIps: () => ['192.168.1.24'] });
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    const joined = await s.join(sess.id, { displayName: 'An', roomCode: code });
    const token = joined.json<{ token: string }>().token;

    const bodies = [
      joined.body,
      (await s.app.inject({ url: '/api/sessions/active' })).body,
      (await s.app.inject({ url: '/api/sessions/latest' })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/participants` })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/leaderboard` })).body,
      (await s.app.inject({ url: '/api/network' })).body,
      (await s.app.inject({ url: '/api/me', headers: { 'x-participant-token': token } })).body,
    ];
    for (const b of bodies) expect(b).not.toContain(code);
    expect(JSON.stringify(JSON.parse(bodies[1]!) as ActiveSession)).not.toMatch(/roomCode/);
    expect(JSON.parse(bodies[6]!) as MeResponse).not.toHaveProperty('session.roomCode');
    void ({} as NetworkInfo | PublicParticipant | LeaderboardResponse);
  });

  it('the mentor API shows it, but only on the mentor machine', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    expect((await s.app.inject({ url: `/api/admin/sessions/${sess.id}`, headers: s.headers })).body).toContain(code);
    expect((await s.app.inject({ url: `/api/admin/sessions/${sess.id}`, headers: s.headers, remoteAddress: '192.168.1.50' })).statusCode).toBe(403);
  });
});

describe('GET /api/screen/room (the projector)', () => {
  it('returns the active session\'s code on the mentor machine; null with nothing open', async () => {
    const s = await setup();
    expect((await s.app.inject({ url: '/api/screen/room' })).json()).toEqual({ roomCode: null });
    const sess = await s.create();
    expect((await s.app.inject({ url: '/api/screen/room' })).json()).toEqual({ roomCode: null }); // draft
    await s.admin(`/sessions/${sess.id}/open`);
    expect((await s.app.inject({ url: '/api/screen/room' })).json()).toEqual({ roomCode: roomCodeOf(s.app, sess.id) });
    await s.admin(`/sessions/${sess.id}/start`);
    expect((await s.app.inject({ url: '/api/screen/room' })).json()).toEqual({ roomCode: roomCodeOf(s.app, sess.id) });
    await s.admin(`/sessions/${sess.id}/close`);
    expect((await s.app.inject({ url: '/api/screen/room' })).json()).toEqual({ roomCode: null }); // the code is dead once it closes
  });

  it('refuses every other machine — and --allow-remote-admin must not change that', async () => {
    for (const allowRemoteAdmin of [false, true]) {
      const s = await setup({ allowRemoteAdmin });
      const sess = await s.create();
      await s.admin(`/sessions/${sess.id}/open`);
      const res = await s.app.inject({ url: '/api/screen/room', remoteAddress: '192.168.1.50' });
      expect(res.statusCode, `allowRemoteAdmin=${allowRemoteAdmin}`).toBe(403);
      expect(res.body).not.toContain(roomCodeOf(s.app, sess.id));
    }
  });

  it('a forged X-Forwarded-For from a LAN client does not make it local', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const res = await s.app.inject({ url: '/api/screen/room', remoteAddress: '192.168.1.50', headers: { 'x-forwarded-for': '127.0.0.1' } });
    expect(res.statusCode).toBe(403);
  });
});
