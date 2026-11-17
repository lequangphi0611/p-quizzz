import { describe, expect, it } from 'vitest';
import type { ActiveSession, GroupDetail, RosterCounts, ScreenSessions, SessionDetail } from '../../../shared/api/index.js';
import { allKeys } from '../world.js';
import { createTestApp, loginAsMentor, roomCodeOf, seedExam } from '../helpers.js';

const LIST = ['phi78@gmail.com', 'phi89@gmail.com'];

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const { app, db } = await createTestApp(opts);
  const headers = await loginAsMentor(app);
  const exam = seedExam(db, { hasEssay: false });
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const makeSession = async (extra: object = {}, open = true) => {
    const s = (await admin('POST', '/sessions', { examId: exam.id, ...extra })).json<SessionDetail>();
    if (open) await admin('POST', `/sessions/${s.id}/open`);
    return s;
  };
  const rosterSession = (extra: object = {}) => makeSession({ access: { kind: 'emails', emails: LIST }, ...extra });
  const detail = async (id: number) => (await admin('GET', `/sessions/${id}`)).json<SessionDetail>();
  const join = (id: number, body: Record<string, unknown>, remoteAddress = '192.168.1.50') =>
    app.inject({ method: 'POST', url: `/api/sessions/${id}/join`, payload: { roomCode: roomCodeOf(app, id), ...body }, remoteAddress });
  return { app, db, headers, exam, admin, makeSession, rosterSession, detail, join };
}

describe('joining a roster session', () => {
  it('an email on the list goes straight in (no mentor approval), case-insensitively; the mentor sees the email, nobody else', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    const res = await s.join(sess.id, { displayName: 'Phi', email: ' Phi78@Gmail.com ' });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ participant: { status: string } }>().participant.status).toBe('active');
    expect(res.body).not.toMatch(/email|phi78/);
    const d = await s.detail(sess.id);
    expect(d.participants).toMatchObject([{ displayName: 'Phi', status: 'active', email: 'phi78@gmail.com' }]);
    expect(d.roster).toEqual({ size: 2, joined: 1, notJoined: ['phi89@gmail.com'] });
  });

  it('an email that is not on the list is refused with one message; nobody is created', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    const bodies = new Set<string>();
    for (const email of ['stranger@gmail.com', 'phi78@gmail.vn', 'phi7@gmail.com']) {
      const res = await s.join(sess.id, { displayName: 'X', email });
      expect(res.statusCode).toBe(403);
      bodies.add(res.body);
    }
    expect(bodies.size).toBe(1);
    expect([...bodies][0]).toBe(JSON.stringify({ error: 'Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.' }));
    expect((await s.detail(sess.id)).participants).toEqual([]);
  });

  it('"Cho xin duyệt": outsiders wait for the mentor, and the mentor can approve them', async () => {
    const s = await setup();
    const sess = await s.rosterSession({ outsiderPolicy: 'pending' });
    expect(sess.outsiderPolicy).toBe('pending');
    const res = await s.join(sess.id, { displayName: 'Lạ', email: 'stranger@gmail.com' });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ participant: { id: number; status: string } }>().participant.status).toBe('pending');
    const id = (await s.detail(sess.id)).participants[0]!.id;
    expect((await s.admin('POST', `/participants/${id}/approve`)).statusCode).toBe(200);
  });

  it('needs an email that looks like one (400); a duplicate is 409 with the code the web uses to offer "ask to come back"', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    expect((await s.join(sess.id, { displayName: 'Phi' })).statusCode).toBe(400);
    expect((await s.join(sess.id, { displayName: 'Phi', email: 'phi78@' })).statusCode).toBe(400);
    expect((await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' })).statusCode).toBe(201);
    const again = await s.join(sess.id, { displayName: 'Phi 2', email: 'PHI78@gmail.com' });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'Email này đã có người vào phòng', code: 'identity_in_use' });
    const nameClash = await s.join(sess.id, { displayName: 'phi', email: 'phi89@gmail.com' });
    expect(nameClash.statusCode).toBe(409);
    expect(nameClash.json()).toMatchObject({ code: 'identity_in_use' });
  });

  it('a free session ignores an email that is sent; it is not stored', async () => {
    const s = await setup();
    const sess = await s.makeSession({ autoApprove: true });
    expect((await s.join(sess.id, { displayName: 'An', email: 'an@x.com' })).statusCode).toBe(201);
    expect((await s.detail(sess.id)).participants[0]).toMatchObject({ email: null });
  });

  it('the same email may be in two parallel sessions (one attempt per session each)', async () => {
    const s = await setup();
    const [a, b] = [await s.rosterSession(), await s.rosterSession()];
    expect((await s.join(a.id, { displayName: 'Phi', email: 'phi78@gmail.com' })).statusCode).toBe(201);
    expect((await s.join(b.id, { displayName: 'Phi', email: 'phi78@gmail.com' })).statusCode).toBe(201);
  });

  it('turned-away emails count towards the per-address limit, together with wrong codes (429 even for the right email)', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    for (let i = 0; i < 5; i++) expect((await s.join(sess.id, { displayName: 'X', email: `guess${i}@gmail.com` }, '192.168.1.80')).statusCode).toBe(403);
    const blocked = await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' }, '192.168.1.80');
    expect(blocked.statusCode).toBe(429);
    expect((await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' }, '192.168.1.81')).statusCode).toBe(201);
  });

  it('resolve tells the join form whether to ask for an email', async () => {
    const s = await setup();
    const free = await s.makeSession();
    const roster = await s.rosterSession();
    const resolve = async (id: number) => (await s.app.inject({ method: 'POST', url: '/api/rooms/resolve', payload: { roomCode: roomCodeOf(s.app, id) } })).json<ActiveSession>();
    expect((await resolve(free.id)).access).toBe('free');
    const r = await resolve(roster.id);
    expect(r.access).toBe('roster');
    expect(JSON.stringify(r)).not.toMatch(/phi78|email|member/); // nothing about the list leaks through resolve
  });
});

describe('emails stay with the mentor (PRODUCT.md §7.24)', () => {
  it('no public or member response carries an email address or an email key', async () => {
    const s = await setup();
    const sess = await s.rosterSession({ name: '#member-0908' });
    const joined = await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' });
    const token = joined.json<{ token: string }>().token;
    await s.admin('POST', `/sessions/${sess.id}/start`);

    const me = { 'x-participant-token': token };
    const bodies = [
      joined.body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/public` })).body,
      (await s.app.inject({ method: 'POST', url: '/api/rooms/resolve', payload: { roomCode: roomCodeOf(s.app, sess.id) } })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/participants` })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/leaderboard` })).body,
      (await s.app.inject({ url: `/api/sessions/${sess.id}/roster-counts` })).body,
      (await s.app.inject({ url: '/api/me', headers: me })).body,
      (await s.app.inject({ url: '/api/screen/sessions', remoteAddress: '127.0.0.1' })).body,
    ];
    for (const b of bodies) {
      expect(b).not.toMatch(/phi78|phi89|@gmail/);
      const keys = allKeys(JSON.parse(b));
      expect(keys.has('email') || keys.has('emails'), b).toBe(false);
    }
    // …while the mentor's own view has it.
    expect(JSON.stringify(await s.detail(sess.id))).toContain('phi78@gmail.com');
  });

  it('GET /roster-counts gives numbers only for roster sessions; null for free; 404 for unknown', async () => {
    const s = await setup();
    const roster = await s.rosterSession();
    const free = await s.makeSession();
    const counts = async (id: number | string) => s.app.inject({ url: `/api/sessions/${id}/roster-counts`, remoteAddress: '192.168.1.50' });
    expect((await counts(roster.id)).json<RosterCounts>()).toEqual({ joinedCount: 0, rosterSize: 2 });
    await s.join(roster.id, { displayName: 'Phi', email: 'phi78@gmail.com' });
    expect((await counts(roster.id)).json<RosterCounts>()).toEqual({ joinedCount: 1, rosterSize: 2 });
    expect((await counts(free.id)).body).toBe('null');
    expect((await counts(999)).statusCode).toBe(404);
    expect((await counts('abc')).statusCode).toBe(404);
  });

  it('a kicked person no longer counts as joined, and their email is free again', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' });
    const id = (await s.detail(sess.id)).participants[0]!.id;
    await s.admin('POST', `/participants/${id}/kick`);
    const d = await s.detail(sess.id);
    expect(d.roster).toEqual({ size: 2, joined: 0, notJoined: LIST });
    expect((await s.join(sess.id, { displayName: 'Phi', email: 'phi78@gmail.com' })).statusCode).toBe(201);
  });
});

describe('the mentor adjusts a session\'s list', () => {
  it('adds emails to one running session; the new email can join; the saved group is untouched', async () => {
    const s = await setup();
    const g = (await s.admin('POST', '/groups', { name: 'Lớp', emails: LIST })).json<GroupDetail>();
    const sess = await s.makeSession({ access: { kind: 'group', groupId: g.id } });
    expect((await s.join(sess.id, { displayName: 'Linh', email: 'linh@company.vn' })).statusCode).toBe(403);
    const added = await s.admin('POST', `/sessions/${sess.id}/roster`, { emails: ['Linh@Company.vn', 'phi78@gmail.com'] });
    expect(added.statusCode).toBe(200);
    expect(added.json<SessionDetail>().roster).toMatchObject({ size: 3 });
    expect((await s.join(sess.id, { displayName: 'Linh', email: 'linh@company.vn' })).statusCode).toBe(201);
    expect((await s.admin('GET', `/groups/${g.id}`)).json<GroupDetail>().emails).toEqual(LIST);
  });

  it('refuses a bad email (400), a free session (409), an ended session (409), unknown ids (404)', async () => {
    const s = await setup();
    const roster = await s.rosterSession();
    const free = await s.makeSession();
    expect((await s.admin('POST', `/sessions/${roster.id}/roster`, { emails: ['x@'] })).statusCode).toBe(400);
    expect((await s.admin('POST', `/sessions/${roster.id}/roster`, { emails: [] })).statusCode).toBe(400);
    expect((await s.admin('POST', `/sessions/${free.id}/roster`, { emails: ['a@x.com'] })).statusCode).toBe(409);
    expect((await s.admin('POST', '/sessions/999/roster', { emails: ['a@x.com'] })).statusCode).toBe(404);
    for (const x of ['start', 'close']) await s.admin('POST', `/sessions/${roster.id}/${x}`);
    expect((await s.admin('POST', `/sessions/${roster.id}/roster`, { emails: ['a@x.com'] })).statusCode).toBe(409);
  });

  it('a typed list can be saved as a group; the session then points at it', async () => {
    const s = await setup();
    const sess = await s.rosterSession();
    expect(sess.rosterSource).toBe('temp');
    const saved = await s.admin('POST', `/sessions/${sess.id}/save-group`, { name: '#docker-1511' });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toEqual({ id: expect.any(Number), name: '#docker-1511', emailCount: 2 });
    expect((await s.detail(sess.id)).rosterSource).toBe('group');
    expect((await s.admin('GET', '/groups')).json<{ name: string }[]>().map(g => g.name)).toEqual(['#docker-1511']);
    expect((await s.admin('POST', `/sessions/${sess.id}/save-group`, { name: 'khác' })).statusCode).toBe(409);
    expect((await s.admin('POST', `/sessions/${sess.id}/save-group`, {})).statusCode).toBe(400);
  });

  it('creating a session: auto-approve is ignored for a roster; an unknown group or empty list is refused', async () => {
    const s = await setup();
    const sess = await s.rosterSession({ autoApprove: true });
    expect(sess.autoApprove).toBe(false);
    expect((await s.admin('POST', '/sessions', { examId: s.exam.id, access: { kind: 'group', groupId: 99 } })).statusCode).toBe(404);
    expect((await s.admin('POST', '/sessions', { examId: s.exam.id, access: { kind: 'emails', emails: [] } })).statusCode).toBe(400);
    expect((await s.admin('POST', '/sessions', { examId: s.exam.id, access: { kind: 'emails', emails: ['a@x.com', 'bad@'] } })).statusCode).toBe(400);
    expect((await s.admin('GET', '/sessions')).json<unknown[]>()).toHaveLength(1); // the refused ones left nothing behind
  });

  it('the projector chooser still carries no emails', async () => {
    const s = await setup();
    await s.rosterSession({ name: '#member-0908' });
    const body = (await s.app.inject({ url: '/api/screen/sessions' })).json<ScreenSessions>();
    expect(JSON.stringify(body)).not.toMatch(/@|phi78/);
  });
});
