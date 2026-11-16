import { describe, expect, it } from 'vitest';
import type { JoinResponse, MeResponse, SessionDetail } from '../../../shared/api/index.js';
import { bus } from '../../infrastructure/events/event-bus.js';
import { createTestApp, joinAs, loginAsMentor, roomCodeOf, seedExam } from '../helpers.js';

async function setup(opts: { hasEssay?: boolean } = {}) {
  const { app, db } = await createTestApp();
  const headers = await loginAsMentor(app);
  const exam = seedExam(db, { title: 'Đề Git', hasEssay: opts.hasEssay ?? false });
  const act = (id: number, action: string) => app.inject({ method: 'POST', url: `/api/admin/sessions/${id}/${action}`, headers });
  const newSession = async (status: 'draft' | 'lobby' | 'running' | 'closed' = 'lobby') => {
    const s = (await app.inject({ method: 'POST', url: '/api/admin/sessions', headers, payload: { examId: exam.id } })).json<SessionDetail>();
    const steps = { draft: [], lobby: ['open'], running: ['open', 'start'], closed: ['open', 'start', 'close'] }[status];
    for (const a of steps) await act(s.id, a);
    return s.id;
  };
  // Adds the session's real room code unless the test supplies its own (or the session has none yet).
  const join = (sessionId: number, payload: unknown, remoteAddress?: string) => {
    let body = payload;
    if (body && typeof body === 'object' && !('roomCode' in body)) {
      try { body = { ...body, roomCode: roomCodeOf(app, sessionId) }; } catch { /* draft session: no code */ }
    }
    return app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/join`, payload: body as object, remoteAddress });
  };
  const me = (token?: string) => app.inject({ url: '/api/me', headers: token ? { 'x-participant-token': token } : {} });
  const detail = async (id: number) => (await app.inject({ url: `/api/admin/sessions/${id}`, headers })).json<SessionDetail>();
  const admin = (method: 'PATCH' | 'POST', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const idOf = async (sessionId: number, name: string) => (await detail(sessionId)).participants.find(p => p.displayName === name)!.id;
  return { app, db, headers, newSession, join, me, detail, admin, idOf, act };
}

describe('POST /api/sessions/:id/join', () => {
  it('a session created with autoApprove lets everyone straight in, in the lobby and after the start', async () => {
    const { app, headers, newSession, join, me, act } = await setup();
    const sid = await newSession('draft');
    expect((await app.inject({ method: 'GET', url: `/api/admin/sessions/${sid}`, headers })).json<SessionDetail>().autoApprove).toBe(false); // default: mentor approves
    const s = (await app.inject({ method: 'POST', url: '/api/admin/sessions', headers, payload: { examId: 1, autoApprove: true } })).json<SessionDetail>();
    expect(s.autoApprove).toBe(true);
    await act(s.id, 'open');
    const a = (await join(s.id, { displayName: 'An' })).json<JoinResponse>();
    expect(a.participant.status).toBe('active');
    await act(s.id, 'start');
    const late = (await join(s.id, { displayName: 'Bình' })).json<JoinResponse>();
    expect(late.participant.status).toBe('active'); // the mentor opted out of the gate for latecomers too
    expect((await me(late.token)).json<MeResponse>().session.participantCount).toBe(2);
  });

  it('lobby → pending until the mentor approves; returns a 32-byte base64url token and the participant (public, no cookie)', async () => {
    const { newSession, join, me, admin, idOf } = await setup();
    const sid = await newSession('lobby');
    const res = await join(sid, { displayName: 'An' });
    expect(res.statusCode).toBe(201);
    const body = res.json<JoinResponse>();
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.participant).toMatchObject({ displayName: 'An', status: 'pending' }); // one name per real person: the mentor lets people in
    expect(Object.keys(body.participant)).not.toContain('token');
    expect((await me(body.token)).json<MeResponse>().session.participantCount).toBe(0); // not in the room yet
    expect((await admin('POST', `/participants/${await idOf(sid, 'An')}/approve`)).statusCode).toBe(200);
    expect((await me(body.token)).json<MeResponse>().participant.status).toBe('active');
  });

  it('running → pending (waits for the mentor)', async () => {
    const { newSession, join } = await setup();
    const res = await join(await newSession('running'), { displayName: 'Bình' });
    expect(res.statusCode).toBe(201);
    expect(res.json<JoinResponse>().participant.status).toBe('pending');
  });

  it('a draft session → 409 "Phiên thi không mở"; unknown or malformed session → 404', async () => {
    const { newSession, join, app } = await setup();
    const res = await join(await newSession('draft'), { displayName: 'An', roomCode: '123456' }); // a draft has no code yet; the status check comes first
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Phiên thi không mở' });
    expect((await join(999, { displayName: 'An', roomCode: '123456' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/sessions/abc/join', payload: { displayName: 'An', roomCode: '123456' } })).statusCode).toBe(404);
  });

  it('closed (essay exam) and finalized (multiple-choice exam) sessions are not joinable', async () => {
    const essay = await setup({ hasEssay: true });
    const closed = await essay.newSession('closed');
    expect((await essay.detail(closed)).status).toBe('closed');
    expect((await essay.join(closed, { displayName: 'An' })).json()).toEqual({ error: 'Phiên thi không mở' });

    const mc = await setup({ hasEssay: false });
    const finalized = await mc.newSession('closed');
    expect((await mc.detail(finalized)).status).toBe('finalized');
    expect((await mc.join(finalized, { displayName: 'An' })).statusCode).toBe(409);
  });

  it('normalizes the name: trims, collapses whitespace, composes accents', async () => {
    const { newSession, join } = await setup();
    const sid = await newSession();
    expect((await join(sid, { displayName: '  An   Bình \t' })).json<JoinResponse>().participant.displayName).toBe('An Bình');
    const decomposed = 'Hạnh'; // "Hạnh" with a combining dot below
    expect((await join(sid, { displayName: decomposed })).json<JoinResponse>().participant.displayName).toBe('Hạnh');
  });

  it('rejects empty, whitespace-only, missing, non-string and over-30-character names with 400', async () => {
    const { newSession, join } = await setup();
    const sid = await newSession();
    for (const payload of [{ displayName: '' }, { displayName: '   ' }, {}, { displayName: 5 }, undefined, { displayName: 'x'.repeat(31) }]) {
      const res = await join(sid, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(typeof res.json().error).toBe('string');
    }
    expect((await join(sid, { displayName: 'x'.repeat(30) })).statusCode).toBe(201);
  });

  it('duplicate names → 409, case-insensitively, including Vietnamese letters and other normalization forms', async () => {
    const { newSession, join } = await setup();
    const sid = await newSession();
    await join(sid, { displayName: 'Nguyễn Đạt' });
    for (const dup of ['nguyễn đạt', 'NGUYỄN ĐẠT', '  Nguyễn   Đạt ', 'Nguyễn Đạt']) {
      const res = await join(sid, { displayName: dup });
      expect(res.statusCode, dup).toBe(409);
      // At join the member may ask the mentor to let them back in (PRODUCT.md §7.23): the error carries a code for the web.
      expect(res.json()).toEqual({ error: 'Tên đã có người dùng', code: 'identity_in_use' });
    }
  });

  it('a pending member holds the name too; the same name is fine in another session', async () => {
    const { newSession, join, act, detail } = await setup();
    const a = await newSession('running');
    await join(a, { displayName: 'An' }); // pending
    expect((await join(a, { displayName: 'an' })).statusCode).toBe(409);

    await act(a, 'close'); // multiple-choice exam → finalized, frees the active slot
    expect((await detail(a)).status).toBe('finalized');
    const b = await newSession('lobby');
    expect((await join(b, { displayName: 'An' })).statusCode).toBe(201);
  });
});

describe('GET /api/me', () => {
  it('401 without or with an unknown token', async () => {
    const { me } = await setup();
    expect((await me()).statusCode).toBe(401);
    expect((await me('nope')).statusCode).toBe(401);
  });

  it('returns the participant, the session and the attempt state', async () => {
    const { newSession, join, me, admin, idOf } = await setup();
    const sid = await newSession('lobby');
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    await admin('POST', `/participants/${await idOf(sid, 'An')}/approve`);
    const res = await me(token);
    expect(res.statusCode).toBe(200);
    expect(res.json<MeResponse>()).toEqual({
      participant: { id: expect.any(Number), displayName: 'An', status: 'active', joinedAt: expect.any(Number) },
      session: { id: sid, title: 'Đề Git', status: 'lobby', participantCount: 1, questionCount: 3, totalPoints: 7, hasEssay: false },
      attempt: { current: null, submitted: [], canStartNew: false }, // lobby: nothing to start yet
    });
  });

  it('participantCount counts active members only (not pending or kicked)', async () => {
    const { newSession, join, me, admin, idOf, act } = await setup();
    const sid = await newSession('lobby');
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    await join(sid, { displayName: 'Bình' });
    await join(sid, { displayName: 'Chi' });
    for (const n of ['An', 'Bình', 'Chi']) await admin('POST', `/participants/${await idOf(sid, n)}/approve`);
    expect((await me(token)).json<MeResponse>().session.participantCount).toBe(3);
    await admin('POST', `/participants/${await idOf(sid, 'Chi')}/kick`);
    expect((await me(token)).json<MeResponse>().session.participantCount).toBe(2);
    await act(sid, 'start');
    await join(sid, { displayName: 'Dũng' }); // pending: not counted
    expect((await me(token)).json<MeResponse>().session.participantCount).toBe(2);
  });

  it('a pending member can call it and sees status pending; the session status follows the mentor', async () => {
    const { newSession, join, me, act } = await setup();
    const sid = await newSession('running');
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    expect((await me(token)).json<MeResponse>().participant.status).toBe('pending');
    await act(sid, 'close');
    expect((await me(token)).json<MeResponse>().session.status).toBe('finalized');
  });

  it('a kicked member gets 403 with the Vietnamese message', async () => {
    const { newSession, join, me, admin, idOf } = await setup();
    const sid = await newSession();
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    await admin('POST', `/participants/${await idOf(sid, 'An')}/kick`);
    const res = await me(token);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Bạn đã bị mời ra khỏi phiên' });
  });
});

describe('mentor: kick / approve / rename', () => {
  it('all participant routes need the mentor cookie', async () => {
    const { app, newSession, join, idOf } = await setup();
    const sid = await newSession();
    await join(sid, { displayName: 'An' });
    const id = await idOf(sid, 'An');
    for (const [method, url] of [['PATCH', `/api/admin/participants/${id}`], ['POST', `/api/admin/participants/${id}/kick`], ['POST', `/api/admin/participants/${id}/approve`]] as const) {
      expect((await app.inject({ method, url, payload: { displayName: 'X' } })).statusCode, url).toBe(401);
    }
  });

  it('kick sets status kicked, frees the name, and a second kick is 409', async () => {
    const { newSession, join, admin, idOf, detail } = await setup();
    const sid = await newSession();
    await join(sid, { displayName: 'An' });
    const id = await idOf(sid, 'An');

    const res = await admin('POST', `/participants/${id}/kick`);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('kicked');
    expect((await admin('POST', `/participants/${id}/kick`)).statusCode).toBe(409);
    expect((await detail(sid)).participants[0]!.status).toBe('kicked');
    expect((await join(sid, { displayName: 'An' })).statusCode).toBe(201); // name is free again
  });

  it('approve only applies to pending members', async () => {
    const { newSession, join, admin, idOf, me } = await setup();
    const sid = await newSession('running');
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    const id = await idOf(sid, 'An');

    const ok = await admin('POST', `/participants/${id}/approve`);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe('active');
    expect((await me(token)).json<MeResponse>().participant.status).toBe('active');

    const again = await admin('POST', `/participants/${id}/approve`);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'Chỉ duyệt được người đang chờ duyệt' });
    await admin('POST', `/participants/${id}/kick`);
    expect((await admin('POST', `/participants/${id}/approve`)).statusCode).toBe(409);
  });

  it('rename: ok; duplicate → 409; own name in a different case is allowed; invalid → 400; kicked → 409', async () => {
    const { newSession, join, admin, idOf } = await setup();
    const sid = await newSession();
    await join(sid, { displayName: 'An' });
    await join(sid, { displayName: 'Bình' });
    const an = await idOf(sid, 'An');
    const binh = await idOf(sid, 'Bình');

    expect((await admin('PATCH', `/participants/${an}`, { displayName: '  Anh  Tuấn ' })).json().displayName).toBe('Anh Tuấn');
    const dup = await admin('PATCH', `/participants/${an}`, { displayName: 'bình' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: 'Tên đã có người dùng' });
    expect((await admin('PATCH', `/participants/${an}`, { displayName: 'ANH TUẤN' })).statusCode).toBe(200);
    expect((await admin('PATCH', `/participants/${an}`, { displayName: '  ' })).statusCode).toBe(400);
    expect((await admin('PATCH', `/participants/${an}`, {})).statusCode).toBe(400);

    await admin('POST', `/participants/${binh}/kick`);
    expect((await admin('PATCH', `/participants/${binh}`, { displayName: 'Mới' })).statusCode).toBe(409);
  });

  it('404 for an unknown or malformed participant id', async () => {
    const { admin } = await setup();
    expect((await admin('POST', '/participants/999/kick')).statusCode).toBe(404);
    expect((await admin('POST', '/participants/999/approve')).statusCode).toBe(404);
    expect((await admin('PATCH', '/participants/999', { displayName: 'X' })).statusCode).toBe(404);
    expect((await admin('POST', '/participants/abc/kick')).statusCode).toBe(404);
  });
});

describe('admin session detail', () => {
  it('lists participants with id, displayName, status and joinedAt', async () => {
    const { newSession, join, detail, admin, idOf } = await setup();
    const sid = await newSession();
    await join(sid, { displayName: 'An' });
    await join(sid, { displayName: 'Bình' });
    expect((await detail(sid)).participants.map(p => [p.displayName, p.status])).toEqual([['An', 'pending'], ['Bình', 'pending']]);
    await admin('POST', `/participants/${await idOf(sid, 'An')}/approve`);
    const d = await detail(sid);
    expect(d.participantCount).toBe(1);
    expect(d.participants.map(p => [p.displayName, p.status])).toEqual([['An', 'active'], ['Bình', 'pending']]);
    expect(d.participants[0]!.joinedAt).toBeGreaterThan(0);
  });
});

describe('realtime signal', () => {
  it('join/approve → participants; rename/kick → participants + leaderboard — and nothing when a call fails', async () => {
    const { newSession, join, admin, idOf } = await setup();
    const sid = await newSession('running');
    const events: string[] = [];
    const off = bus.subscribe(sid, t => events.push(t));
    const take = () => events.splice(0).sort();

    await join(sid, { displayName: 'An' });
    expect(take()).toEqual(['participants']);
    const id = await idOf(sid, 'An');
    await admin('POST', `/participants/${id}/approve`);
    expect(take()).toEqual(['participants']);
    await admin('PATCH', `/participants/${id}`, { displayName: 'Anh' });
    expect(take()).toEqual(['leaderboard', 'participants']); // the ranking shows names
    await admin('POST', `/participants/${id}/kick`);
    expect(take()).toEqual(['leaderboard', 'participants']); // a kicked member leaves the ranking

    await join(sid, { displayName: '' }); // 400
    await admin('POST', `/participants/${id}/kick`); // 409
    await admin('POST', `/participants/${id}/approve`); // 409
    expect(take()).toEqual([]);
    off();
  });
});

describe('token never leaks', () => {
  it('appears only in the join response — not in /me, session detail, list, or the mentor actions', async () => {
    const { app, headers, newSession, join, me, admin, idOf, detail } = await setup();
    const sid = await newSession('running');
    const { token } = (await join(sid, { displayName: 'An' })).json<JoinResponse>();
    const id = await idOf(sid, 'An');
    expect((await join(sid, { displayName: 'An' })).body).not.toContain(token); // 409 body

    const bodies = [
      (await me(token)).body,
      JSON.stringify(await detail(sid)),
      (await app.inject({ url: '/api/admin/sessions', headers })).body,
      (await app.inject({ url: '/api/sessions/active' })).body,
      (await admin('POST', `/participants/${id}/approve`)).body,
      (await admin('PATCH', `/participants/${id}`, { displayName: 'Anh' })).body,
      (await admin('POST', `/participants/${id}/kick`)).body,
    ];
    for (const b of bodies) expect(b).not.toContain(token);
  });

  it('joinAs helper returns the token', async () => {
    const { app, newSession } = await setup();
    const token = await joinAs(app, await newSession(), 'An');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
