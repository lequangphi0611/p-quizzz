import { describe, expect, it } from 'vitest';
import type { EmailListPreview, GroupDetail, GroupSummary, SessionDetail } from '../../../shared/api/index.js';
import { createTestApp, loginAsMentor, seedExam } from '../helpers.js';

async function setup() {
  const { app, db } = await createTestApp();
  const headers = await loginAsMentor(app);
  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  return { app, db, headers, call };
}

describe('groups API — mentor only', () => {
  it('every route is 401 without the mentor cookie and 403 from another machine', async () => {
    const { app, call } = await setup();
    for (const [method, url] of [['GET', '/api/admin/groups'], ['POST', '/api/admin/groups'], ['POST', '/api/admin/groups/preview'], ['GET', '/api/admin/groups/1'], ['PUT', '/api/admin/groups/1'], ['DELETE', '/api/admin/groups/1']] as const) {
      expect((await app.inject({ method, url })).statusCode, `${method} ${url}`).toBe(401);
    }
    const headers = await loginAsMentor(app);
    expect((await app.inject({ url: '/api/admin/groups', headers, remoteAddress: '192.168.1.50' })).statusCode).toBe(403);
    void call;
  });
});

describe('POST /groups/preview', () => {
  it('parses pasted text: valid (with the default domain), merged duplicates and bad lines, with line numbers', async () => {
    const { call } = await setup();
    const res = await call('POST', '/groups/preview', { text: 'phi78@gmail.com\nminh\nPhi78@Gmail.com\nphi89@', defaultDomain: '@company.vn' });
    expect(res.statusCode).toBe(200);
    const p = res.json<EmailListPreview>();
    expect(p.valid.map(v => [v.email, v.line, v.addedDomain])).toEqual([['phi78@gmail.com', 1, false], ['minh@company.vn', 2, true]]);
    expect(p.duplicates).toMatchObject([{ email: 'phi78@gmail.com', line: 3, firstLine: 1 }]);
    expect(p.invalid.map(i => [i.line, i.raw])).toEqual([[4, 'phi89@']]);
  });

  it('saves nothing and refuses a body without text', async () => {
    const { call } = await setup();
    expect((await call('POST', '/groups/preview', {})).statusCode).toBe(400);
    expect((await call('GET', '/groups')).json()).toEqual([]);
  });
});

describe('groups CRUD', () => {
  it('creates a group (emails normalized, de-duplicated, order kept), lists it, and reads it back', async () => {
    const { call } = await setup();
    const created = await call('POST', '/groups', { name: '#member-0908', emails: ['Philq@Gmail.com', 'phiabc@gmail.com', 'philq@gmail.com'] });
    expect(created.statusCode).toBe(201);
    const g = created.json<GroupDetail>();
    expect(g).toMatchObject({ name: '#member-0908', emailCount: 2, emails: ['philq@gmail.com', 'phiabc@gmail.com'], lastUsedAt: null });
    expect((await call('GET', '/groups')).json<GroupSummary[]>()).toMatchObject([{ id: g.id, name: '#member-0908', emailCount: 2 }]);
    expect((await call('GET', `/groups/${g.id}`)).json<GroupDetail>().emails).toEqual(['philq@gmail.com', 'phiabc@gmail.com']);
  });

  it('refuses a bad email (naming it), an empty list, a blank or too long name, and a repeated name', async () => {
    const { call } = await setup();
    const bad = await call('POST', '/groups', { name: 'A', emails: ['ok@x.com', 'phi89@'] });
    expect(bad.statusCode).toBe(400);
    expect(bad.json<{ error: string }>().error).toContain('phi89@');
    expect((await call('POST', '/groups', { name: 'A', emails: [] })).statusCode).toBe(400);
    expect((await call('POST', '/groups', { name: '  ', emails: ['a@x.com'] })).statusCode).toBe(400);
    expect((await call('POST', '/groups', { name: 'x'.repeat(61), emails: ['a@x.com'] })).statusCode).toBe(400);
    expect((await call('POST', '/groups', { name: 'Lớp A', emails: ['a@x.com'] })).statusCode).toBe(201);
    expect((await call('POST', '/groups', { name: ' LỚP a ', emails: ['b@x.com'] })).statusCode).toBe(409);
    expect((await call('GET', '/groups')).json<GroupSummary[]>()).toHaveLength(1);
  });

  it('updates and deletes; unknown or malformed ids are 404', async () => {
    const { call } = await setup();
    const g = (await call('POST', '/groups', { name: 'X', emails: ['a@x.com'] })).json<GroupDetail>();
    const u = (await call('PUT', `/groups/${g.id}`, { name: 'Y', emails: ['b@x.com', 'c@x.com'] })).json<GroupDetail>();
    expect(u).toMatchObject({ name: 'Y', emails: ['b@x.com', 'c@x.com'], emailCount: 2 });
    expect((await call('DELETE', `/groups/${g.id}`)).statusCode).toBe(204);
    for (const [m, url] of [['GET', `/groups/${g.id}`], ['PUT', `/groups/${g.id}`], ['DELETE', `/groups/${g.id}`], ['GET', '/groups/abc']] as const) {
      expect((await call(m, url, m === 'PUT' ? { name: 'Z', emails: ['a@x.com'] } : undefined)).statusCode, `${m} ${url}`).toBe(404);
    }
  });

  it('a session created from a group copies it: later edits or deleting the group change nothing in the session', async () => {
    const { db, call } = await setup();
    const exam = seedExam(db, {});
    const g = (await call('POST', '/groups', { name: 'Lớp', emails: ['an@x.com', 'binh@x.com'] })).json<GroupDetail>();
    const s = (await call('POST', '/sessions', { examId: exam.id, access: { kind: 'group', groupId: g.id } })).json<SessionDetail>();
    expect(s).toMatchObject({ access: 'roster', rosterSource: 'group', roster: { size: 2, joined: 0, notJoined: ['an@x.com', 'binh@x.com'] } });
    expect((await call('GET', '/groups')).json<GroupSummary[]>()[0]!.lastUsedAt).toEqual(expect.any(Number)); // used now

    await call('PUT', `/groups/${g.id}`, { name: 'Lớp', emails: ['chi@x.com'] });
    expect((await call('GET', `/sessions/${s.id}`)).json<SessionDetail>().roster!.notJoined).toEqual(['an@x.com', 'binh@x.com']);
    expect((await call('DELETE', `/groups/${g.id}`)).statusCode).toBe(204); // a session still points at it: the link is just forgotten
    const after = (await call('GET', `/sessions/${s.id}`)).json<SessionDetail>();
    expect(after.roster!.size).toBe(2);
    expect(after.rosterSource).toBe('temp');
  });
});
