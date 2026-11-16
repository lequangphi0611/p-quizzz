import { describe, expect, it } from 'vitest';
import type { RejoinRequestResponse, RejoinStatusResponse, SessionDetail } from '../../../shared/api/index.js';
import { ONLINE_WITHIN_MS } from '../../domain/participant/presence.js';
import { createTestApp, loginAsMentor, roomCodeOf, seedExam } from '../helpers.js';

const LIST = ['phi78@gmail.com', 'phi89@gmail.com'];

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const { app, db } = await createTestApp(opts);
  const headers = await loginAsMentor(app);
  const exam = seedExam(db, { hasEssay: false });
  const admin = (method: 'GET' | 'POST', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const make = async (extra: object) => {
    const s = (await admin('POST', '/sessions', { examId: exam.id, ...extra })).json<SessionDetail>();
    await admin('POST', `/sessions/${s.id}/open`);
    return s;
  };
  const roster = () => make({ access: { kind: 'emails', emails: LIST } });
  const free = () => make({ autoApprove: true });
  const join = (id: number, body: Record<string, unknown>, remoteAddress = '192.168.1.50') =>
    app.inject({ method: 'POST', url: `/api/sessions/${id}/join`, payload: { roomCode: roomCodeOf(app, id), ...body }, remoteAddress });
  const ask = (id: number, body: Record<string, unknown>, remoteAddress = '192.168.1.60') =>
    app.inject({ method: 'POST', url: `/api/sessions/${id}/rejoin-requests`, payload: { roomCode: roomCodeOf(app, id), ...body }, remoteAddress });
  const me = (token: string) => app.inject({ url: '/api/me', headers: { 'x-participant-token': token } });
  const status = (token: string) => app.inject({ url: '/api/rejoin/status', headers: { 'x-participant-token': token } });
  const detail = async (id: number) => (await admin('GET', `/sessions/${id}`)).json<SessionDetail>();
  return { app, db, headers, exam, admin, roster, free, join, ask, me, status, detail };
}
type S = Awaited<ReturnType<typeof setup>>;

async function phiHolds(s: S) {
  const sess = await s.roster();
  const joined = await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' });
  return { sess, token: joined.json<{ token: string }>().token };
}

describe('asking to come back, end to end', () => {
  it('duplicate email → 409 identity_in_use → the asker gets a request token that reads only its own status', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    const clash = await s.join(sess.id, { displayName: 'Phi 2', email: 'phi78@gmail.com' });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ code: 'identity_in_use' });

    const asked = await s.ask(sess.id, { displayName: 'Phi 2', email: 'PHI78@gmail.com' });
    expect(asked.statusCode).toBe(201);
    const r = asked.json<RejoinRequestResponse>();
    expect(r).toMatchObject({ status: 'pending', requestId: expect.any(Number) });
    expect((await s.status(r.token)).json<RejoinStatusResponse>()).toEqual({ status: 'pending', sessionId: sess.id });
    expect((await s.me(r.token)).statusCode).toBe(401); // the request token is not a participant token yet
    expect((await s.me(token)).statusCode).toBe(200); // the holder is untouched
    expect((await s.status('nope')).statusCode).toBe(404);
  });

  it('the mentor sees the request with the holder\'s connection; "giữ bài" moves the seat and tells the old device', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    await s.me(token); // a sign of life
    const asked = (await s.ask(sess.id, { displayName: 'Phi 2', email: 'phi78@gmail.com' })).json<RejoinRequestResponse>();

    const d = await s.detail(sess.id);
    expect(d.rejoinRequests).toEqual([{ id: asked.requestId, participantId: d.participants[0]!.id, claimantName: 'Phi 2', requestedAt: expect.any(Number) }]);
    expect(d.participants[0]).toMatchObject({ displayName: 'Phi', email: 'phi78@gmail.com', connection: { online: true, lastSeenAt: expect.any(Number) } });

    expect((await s.admin('POST', `/rejoin-requests/${asked.requestId}/approve-keep`)).statusCode).toBe(204);
    expect((await s.status(asked.token)).json<RejoinStatusResponse>().status).toBe('approved');
    const now = await s.me(asked.token);
    expect(now.statusCode).toBe(200);
    expect(now.json<{ participant: { displayName: string } }>().participant.displayName).toBe('Phi'); // same person, same name
    const old = await s.me(token);
    expect(old.statusCode).toBe(403);
    expect(old.json()).toEqual({ error: 'Bài của bạn đang được mở ở thiết bị khác', code: 'replaced' });
    expect((await s.detail(sess.id)).rejoinRequests).toEqual([]);
  });

  it('"mạo danh": the holder is sent out, the asker comes in as a new person; "từ chối" leaves the holder alone', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    const a = (await s.ask(sess.id, { displayName: 'Phi thật', email: 'phi78@gmail.com' })).json<RejoinRequestResponse>();
    expect((await s.admin('POST', `/rejoin-requests/${a.requestId}/approve-takeover`)).statusCode).toBe(204);
    expect((await s.me(token)).statusCode).toBe(403); // kicked
    expect((await s.me(a.token)).json<{ participant: { displayName: string; status: string } }>().participant).toMatchObject({ displayName: 'Phi thật', status: 'active' });
    const d = await s.detail(sess.id);
    expect(d.participants.map(p => [p.displayName, p.status, p.email])).toEqual([['Phi', 'kicked', 'phi78@gmail.com'], ['Phi thật', 'active', 'phi78@gmail.com']]);

    const second = await s.ask(sess.id, { displayName: 'Kẻ khác', email: 'phi78@gmail.com' });
    expect((await s.admin('POST', `/rejoin-requests/${second.json<RejoinRequestResponse>().requestId}/reject`)).statusCode).toBe(204);
    expect((await s.status(second.json<RejoinRequestResponse>().token)).json<RejoinStatusResponse>().status).toBe('rejected');
    expect((await s.me(a.token)).statusCode).toBe(200);
  });

  it('allow-rejoin in advance: the same email gets back in at once, with the old device replaced', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    const pid = (await s.detail(sess.id)).participants[0]!.id;
    const allowed = await s.admin('POST', `/participants/${pid}/allow-rejoin`);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json<{ until: number }>().until).toBeGreaterThan(Date.now());
    expect((await s.detail(sess.id)).participants[0]!.rejoinAllowedUntil).toEqual(expect.any(Number));

    const back = await s.join(sess.id, { displayName: 'Bất kỳ', email: 'phi78@gmail.com' });
    expect(back.statusCode).toBe(201);
    expect((await s.me(back.json<{ token: string }>().token)).statusCode).toBe(200);
    expect((await s.me(token)).statusCode).toBe(403);
    expect((await s.join(sess.id, { displayName: 'Lại', email: 'phi78@gmail.com' })).statusCode).toBe(409); // once only
    expect((await s.detail(sess.id)).participants[0]!.rejoinAllowedUntil).toBeNull();
  });

  it('a free session: the name is the identity', async () => {
    const s = await setup();
    const sess = await s.free();
    await s.join(sess.id, { displayName: 'Nguyễn Đạt' });
    const clash = await s.join(sess.id, { displayName: 'nguyễn đạt' });
    expect(clash.json()).toMatchObject({ error: 'Tên đã có người dùng', code: 'identity_in_use' });
    const asked = await s.ask(sess.id, { displayName: 'NGUYỄN ĐẠT' });
    expect(asked.statusCode).toBe(201);
    expect((await s.admin('POST', `/rejoin-requests/${asked.json<RejoinRequestResponse>().requestId}/approve-keep`)).statusCode).toBe(204);
  });

  it('the asker can cancel; a session that closes first expires the request; answered ones cannot be answered again', async () => {
    const s = await setup();
    const { sess } = await phiHolds(s);
    const a = (await s.ask(sess.id, { displayName: 'A', email: 'phi78@gmail.com' })).json<RejoinRequestResponse>();
    expect((await s.app.inject({ method: 'POST', url: '/api/rejoin/cancel', headers: { 'x-participant-token': a.token } })).statusCode).toBe(204);
    expect((await s.status(a.token)).json<RejoinStatusResponse>().status).toBe('cancelled');
    expect((await s.admin('POST', `/rejoin-requests/${a.requestId}/reject`)).statusCode).toBe(409);

    const b = (await s.ask(sess.id, { displayName: 'B', email: 'phi78@gmail.com' })).json<RejoinRequestResponse>();
    for (const step of ['start', 'close']) await s.admin('POST', `/sessions/${sess.id}/${step}`);
    expect((await s.status(b.token)).json<RejoinStatusResponse>().status).toBe('expired');
    expect((await s.admin('POST', `/rejoin-requests/${b.requestId}/approve-keep`)).statusCode).toBe(409);
    expect((await s.admin('POST', '/rejoin-requests/999/reject')).statusCode).toBe(404);
    expect((await s.admin('POST', '/rejoin-requests/abc/reject')).statusCode).toBe(404);
  });
});

describe('guarding the doors', () => {
  it('the mentor routes need the mentor cookie and the mentor machine', async () => {
    const s = await setup();
    for (const url of ['/api/admin/rejoin-requests/1/approve-keep', '/api/admin/rejoin-requests/1/approve-takeover', '/api/admin/rejoin-requests/1/reject', '/api/admin/participants/1/allow-rejoin']) {
      expect((await s.app.inject({ method: 'POST', url })).statusCode, url).toBe(401);
      expect((await s.app.inject({ method: 'POST', url, headers: s.headers, remoteAddress: '192.168.1.50' })).statusCode, url).toBe(403);
    }
  });

  it('a wrong code, an email off the list and a seat nobody holds are refused; none of it leaks who is in', async () => {
    const s = await setup();
    const { sess } = await phiHolds(s);
    expect((await s.ask(sess.id, { displayName: 'X', email: 'phi78@gmail.com', roomCode: '000000' })).statusCode).toBe(403);
    const off = await s.ask(sess.id, { displayName: 'X', email: 'stranger@gmail.com' });
    expect(off.statusCode).toBe(403);
    expect(off.json()).toEqual({ error: 'Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.' });
    expect((await s.ask(sess.id, { displayName: 'X', email: 'phi89@gmail.com' })).statusCode).toBe(409); // on the list, nobody holds it
    expect((await s.ask(sess.id, { displayName: 'X' })).statusCode).toBe(400);
    expect((await s.app.inject({ method: 'POST', url: '/api/sessions/999/rejoin-requests', payload: { roomCode: '123456', displayName: 'X', email: 'phi78@gmail.com' } })).statusCode).toBe(404);
  });

  it('guesses share the join limiter, and requests have their own tighter limit', async () => {
    const s = await setup();
    const { sess } = await phiHolds(s);
    for (let i = 0; i < 5; i++) expect((await s.ask(sess.id, { displayName: 'X', email: `g${i}@gmail.com` }, '192.168.1.70')).statusCode).toBe(403);
    const blocked = await s.ask(sess.id, { displayName: 'X', email: 'phi78@gmail.com' }, '192.168.1.70');
    expect(blocked.statusCode).toBe(429); // the join limiter is spent
    expect((await s.join(sess.id, { displayName: 'Y', email: 'phi89@gmail.com' }, '192.168.1.70')).statusCode).toBe(429); // …for join too

    // Requests: 8 per minute from one address
    for (let i = 0; i < 5; i++) await s.ask(sess.id, { displayName: `R${i}`, email: 'phi78@gmail.com' }, '192.168.1.71'); // 5 queue up
    for (let i = 0; i < 3; i++) expect((await s.ask(sess.id, { displayName: 'S', email: 'phi78@gmail.com' }, '192.168.1.71')).statusCode).toBe(409); // the seat is full
    expect((await s.ask(sess.id, { displayName: 'T', email: 'phi78@gmail.com' }, '192.168.1.71')).statusCode).toBe(429);
  });

  it('the holder\'s token and connection never reach the asker or any public endpoint', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    const asked = await s.ask(sess.id, { displayName: 'Phi 2', email: 'phi78@gmail.com' });
    const r = asked.json<RejoinRequestResponse>();
    const bodies = [
      asked.body,
      (await s.status(r.token)).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/participants` })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/public` })).body,
    ];
    for (const b of bodies) {
      expect(b).not.toContain(token);
      expect(b).not.toMatch(/phi78|"email"|connection|lastSeenAt|rejoinAllowedUntil/);
    }
  });

  it('offline is derived from silence: a member who stops asking turns offline in the mentor\'s view', async () => {
    const s = await setup();
    const { sess, token } = await phiHolds(s);
    await s.me(token);
    expect((await s.detail(sess.id)).participants[0]!.connection.online).toBe(true);
    // (the 15-second rule itself is tested on the domain with an injectable clock)
    expect(ONLINE_WITHIN_MS).toBe(15_000);
  });
});
