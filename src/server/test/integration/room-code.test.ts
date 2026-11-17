import { describe, expect, it } from 'vitest';
import type { ActiveSession, LeaderboardResponse, MeResponse, NetworkInfo, PublicParticipant, ScreenSessions, SessionDetail, SessionSummary } from '../../../shared/api/index.js';
import { createJoinLimiter } from '../../interface/http/join-limiter.js';
import { createTestApp, loginAsMentor, roomCodeOf, seedExam } from '../helpers.js';

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
  it('is absent from public, resolve, participants, leaderboard, network, /api/me and the join response', async () => {
    const s = await setup({ lanIps: () => ['192.168.1.24'] });
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    const joined = await s.join(sess.id, { displayName: 'An', roomCode: code });
    const token = joined.json<{ token: string }>().token;

    const bodies = [
      joined.body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/public` })).body,
      (await s.app.inject({ method: 'POST', url: '/api/rooms/resolve', payload: { roomCode: code } })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/participants` })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/leaderboard` })).body,
      (await s.app.inject({ url: '/api/network' })).body,
      (await s.app.inject({ url: '/api/me', headers: { 'x-participant-token': token } })).body,
    ];
    for (const b of bodies) expect(b).not.toContain(code);
    expect(JSON.stringify(JSON.parse(bodies[1]!) as ActiveSession)).not.toMatch(/roomCode/);
    expect(JSON.parse(bodies[2]!) as ActiveSession).toMatchObject({ id: sess.id }); // resolve works, and still leaks no code
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

describe('POST /api/rooms/resolve (members find their session by code)', () => {
  const resolve = (s: Awaited<ReturnType<typeof setup>>, roomCode: unknown, remoteAddress = '192.168.1.50') =>
    s.app.inject({ method: 'POST', url: '/api/rooms/resolve', payload: { roomCode } as object, remoteAddress });

  it('finds the open session by its code, with spaces or dashes; the answer is the exam title only', async () => {
    const s = await setup();
    const sess = (await s.admin('/sessions', { examId: s.exam.id, name: '#member-0908' })).json<SessionDetail>();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    for (const typed of [code, `${code.slice(0, 3)} ${code.slice(3)}`, `${code.slice(0, 3)}-${code.slice(3)}`]) {
      const res = await resolve(s, typed);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: sess.id, title: s.exam.title, status: 'lobby', access: 'free', timer: null });
      expect(res.body).not.toMatch(/member-0908|roomCode|slot/);
    }
  });

  it('two open sessions: each code finds its own session', async () => {
    const s = await setup();
    const [a, b] = [await s.create(), await s.create()];
    await s.admin(`/sessions/${a.id}/open`);
    await s.admin(`/sessions/${b.id}/open`);
    expect((await resolve(s, roomCodeOf(s.app, a.id))).json<ActiveSession>().id).toBe(a.id);
    expect((await resolve(s, roomCodeOf(s.app, b.id))).json<ActiveSession>().id).toBe(b.id);
  });

  it('a wrong code and a session that has closed both answer 403 "Mã phòng không đúng"; a bad format is 400', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const code = roomCodeOf(s.app, sess.id);
    const wrong = code === '000000' ? '111111' : '000000';
    expect((await resolve(s, wrong)).json()).toEqual({ error: 'Mã phòng không đúng' });
    await s.admin(`/sessions/${sess.id}/start`);
    await s.admin(`/sessions/${sess.id}/close`);
    const closed = await resolve(s, code);
    expect(closed.statusCode).toBe(403);
    expect(closed.json()).toEqual({ error: 'Mã phòng không đúng' }); // identical: closed sessions are not discoverable
    expect((await resolve(s, 'abc')).statusCode).toBe(400);
    expect((await resolve(s, undefined)).statusCode).toBe(400);
  });

  it('shares the join limiter: wrong codes at resolve and at join add up, then both answer 429', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const real = roomCodeOf(s.app, sess.id);
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) expect((await resolve(s, wrong, '192.168.1.70')).statusCode).toBe(403);
    for (let i = 0; i < 2; i++) expect((await s.join(sess.id, { displayName: 'X', roomCode: wrong }, '192.168.1.70')).statusCode).toBe(403);
    const blocked = await resolve(s, real, '192.168.1.70'); // right code, but the address is spent
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await s.join(sess.id, { displayName: 'An', roomCode: real }, '192.168.1.70')).statusCode).toBe(429);
    expect((await resolve(s, real, '192.168.1.71')).statusCode).toBe(200); // another address is fine
  });

  it('is open to LAN machines', async () => {
    const s = await setup();
    expect((await resolve(s, '000000', '192.168.1.50')).statusCode).toBe(403); // answered by the app, not the local-only rule…
    expect((await resolve(s, '000000', '192.168.1.50')).json()).toEqual({ error: 'Mã phòng không đúng' });
  });
});

describe('the projector routes (mentor machine only)', () => {
  const room = (s: Awaited<ReturnType<typeof setup>>, id: number, opts: { remoteAddress?: string; headers?: Record<string, string> } = {}) =>
    s.app.inject({ url: `/api/screen/sessions/${id}/room`, ...opts });

  it('/room returns the code of that open session; null for a draft, a closed or an unknown one', async () => {
    const s = await setup();
    const sess = await s.create();
    expect((await room(s, sess.id)).json()).toEqual({ roomCode: null }); // draft
    await s.admin(`/sessions/${sess.id}/open`);
    expect((await room(s, sess.id)).json()).toEqual({ roomCode: roomCodeOf(s.app, sess.id) });
    await s.admin(`/sessions/${sess.id}/start`);
    expect((await room(s, sess.id)).json()).toEqual({ roomCode: roomCodeOf(s.app, sess.id) });
    await s.admin(`/sessions/${sess.id}/close`);
    expect((await room(s, sess.id)).json()).toEqual({ roomCode: null }); // the code is dead once it closes
    expect((await room(s, 999)).json()).toEqual({ roomCode: null });
    expect((await s.app.inject({ url: '/api/screen/sessions/abc/room' })).statusCode).toBe(404);
  });

  it('each open session shows its own code', async () => {
    const s = await setup();
    const [a, b] = [await s.create(), await s.create()];
    await s.admin(`/sessions/${a.id}/open`);
    await s.admin(`/sessions/${b.id}/open`);
    const [ca, cb] = [(await room(s, a.id)).json<{ roomCode: string }>().roomCode, (await room(s, b.id)).json<{ roomCode: string }>().roomCode];
    expect(ca).toBe(roomCodeOf(s.app, a.id));
    expect(cb).toBe(roomCodeOf(s.app, b.id));
    expect(ca).not.toBe(cb);
  });

  it('/sessions lists the open sessions with the mentor\'s names, or the latest ended one when none is open', async () => {
    const s = await setup();
    const sess = (await s.admin('/sessions', { examId: s.exam.id, name: '#member-0908' })).json<SessionDetail>();
    expect((await s.app.inject({ url: '/api/screen/sessions' })).json()).toEqual({ open: [], latestEnded: null });
    await s.admin(`/sessions/${sess.id}/open`);
    const open = (await s.app.inject({ url: '/api/screen/sessions' })).json<ScreenSessions>();
    expect(open.open).toEqual([{ id: sess.id, name: '#member-0908', slot: 1, title: s.exam.title, status: 'lobby' }]);
    expect(open.latestEnded).toBeNull();
    await s.admin(`/sessions/${sess.id}/start`);
    await s.admin(`/sessions/${sess.id}/close`);
    expect((await s.app.inject({ url: '/api/screen/sessions' })).json<ScreenSessions>()).toMatchObject({ open: [], latestEnded: { id: sess.id, name: '#member-0908', slot: null } });
  });

  it('refuses every other machine, and --allow-remote-admin must not change that (codes and session names stay off the LAN)', async () => {
    for (const allowRemoteAdmin of [false, true]) {
      const s = await setup({ allowRemoteAdmin });
      const sess = (await s.admin('/sessions', { examId: s.exam.id, name: '#member-0908' })).json<SessionDetail>();
      await s.admin(`/sessions/${sess.id}/open`);
      for (const url of [`/api/screen/sessions/${sess.id}/room`, '/api/screen/sessions']) {
        const res = await s.app.inject({ url, remoteAddress: '192.168.1.50' });
        expect(res.statusCode, `${url} allowRemoteAdmin=${allowRemoteAdmin}`).toBe(403);
        expect(res.body).not.toContain(roomCodeOf(s.app, sess.id));
        expect(res.body).not.toContain('member-0908');
      }
    }
  });

  it('a forged X-Forwarded-For from a LAN client does not make it local', async () => {
    const s = await setup();
    const sess = await s.create();
    await s.admin(`/sessions/${sess.id}/open`);
    const res = await room(s, sess.id, { remoteAddress: '192.168.1.50', headers: { 'x-forwarded-for': '127.0.0.1' } });
    expect(res.statusCode).toBe(403);
  });
});
