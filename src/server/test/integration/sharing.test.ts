import { describe, expect, it } from 'vitest';
import type { AttemptView, ReviewView, SessionDetail, ShareLinkInfo, SharedSessionList, SharedSessionView } from '../../../shared/api/index.js';
import { allKeys, world } from '../world.js';

type Picks = { single?: number[]; multi?: number[]; essay?: string };

// Essay exam (single correct = opt 0 · multi correct = opts 0+1 · essay). Members join in the lobby, then it starts.
async function setup(names: string[] = ['An']) {
  const w = await world({ essay: true, shuffle: false, state: 'lobby' });
  const members = new Map<string, { m: ReturnType<typeof w.asMember>; token: string }>();
  members.set('An', { m: w.an, token: '' });
  for (const n of names.filter(n => n !== 'An')) {
    const token = await w.join(n);
    members.set(n, { m: w.asMember(token), token });
  }
  await w.admin(`/sessions/${w.session.id}/start`);
  const submit = async (name: string, p: Picks): Promise<AttemptView> => {
    const { m } = members.get(name)!;
    const v = (await m.start()).json<AttemptView>();
    if (p.single) await m.put(v.id, w.single.q.id, { selectedOptionIds: p.single.map(i => w.single.opts[i]!.id) });
    if (p.multi) await m.put(v.id, w.multi.q.id, { selectedOptionIds: p.multi.map(i => w.multi.opts[i]!.id) });
    if (p.essay) await m.put(v.id, w.essayQ!.id, { textAnswer: p.essay });
    await m.submit(v.id);
    return v;
  };
  const share = (shared: boolean, id = w.session.id) => w.app.inject({ method: 'PUT', url: `/api/admin/sessions/${id}/share`, headers: w.headers, payload: { shared } });
  const link = async () => (await w.app.inject({ url: '/api/admin/share-link', headers: w.headers })).json<ShareLinkInfo>();
  const rotate = async () => (await w.app.inject({ method: 'POST', url: '/api/admin/share-link/rotate', headers: w.headers })).json<ShareLinkInfo>();
  const list = (token: string) => w.app.inject({ url: `/api/shared/${token}/sessions` });
  const detailOf = (token: string, id: number | string = w.session.id) => w.app.inject({ url: `/api/shared/${token}/sessions/${id}` });
  return { ...w, members, submit, share, link, rotate, list, detailOf, close: () => w.admin(`/sessions/${w.session.id}/close`) };
}

describe('sharing a session (PRODUCT.md §7.33)', () => {
  it('mentor-only routes: cookie and mentor machine', async () => {
    const s = await setup();
    expect((await s.app.inject({ url: '/api/admin/share-link' })).statusCode).toBe(401);
    expect((await s.app.inject({ url: '/api/admin/share-link', headers: s.headers, remoteAddress: '192.168.1.50' })).statusCode).toBe(403);
    expect((await s.app.inject({ method: 'PUT', url: '/api/admin/sessions/999/share', headers: s.headers, payload: { shared: true } })).statusCode).toBe(404);
    expect((await s.app.inject({ method: 'PUT', url: `/api/admin/sessions/${s.session.id}/share`, headers: s.headers, payload: { shared: 'yes' } })).statusCode).toBe(400);
  });

  it('can be turned on only once the session ended; off always; on again keeps the first time', async () => {
    const s = await setup();
    const early = await s.share(true);
    expect(early.statusCode).toBe(409);
    expect(early.json()).toEqual({ error: 'Chỉ chia sẻ được sau khi đóng phiên' });
    expect((await s.share(false)).json()).toEqual({ sharedAt: null });
    await s.close();
    const on = (await s.share(true)).json<{ sharedAt: number }>();
    expect(on.sharedAt).toEqual(expect.any(Number));
    expect((await s.share(true)).json()).toEqual(on);
    expect((await s.detail()).sharedAt).toBe(on.sharedAt);
    expect((await s.share(false)).json()).toEqual({ sharedAt: null });
    expect((await s.detail()).sharedAt).toBeNull();
  });

  it('the session detail carries what the warnings need: unfinished sessions of the exam and submissions', async () => {
    const s = await setup(['An', 'Bình']);
    await s.submit('An', { single: [0] });
    await s.admin('/sessions', { examId: s.exam.id }); // another draft of the same exam
    await s.close(); // Bình never started
    expect((await s.detail()).share).toEqual({ examUnfinishedSessions: 1, submitted: 1 });
  });

  it('one link for the page: same token each time, a new one after "Đổi link"; the old one reads as invalid', async () => {
    const s = await setup();
    await s.close();
    await s.share(true);
    const first = await s.link();
    expect(first).toEqual({ token: expect.any(String), sharedCount: 1 });
    expect((await s.link()).token).toBe(first.token);
    expect((await s.list(first.token)).statusCode).toBe(200);
    const next = await s.rotate();
    expect(next.token).not.toBe(first.token);
    const old = await s.list(first.token);
    expect(old.statusCode).toBe(404);
    expect(old.json()).toMatchObject({ code: 'share_link_invalid' });
    expect((await s.list(next.token)).statusCode).toBe(200);
  });

  it('a wrong token reads the same before any link exists and after', async () => {
    const s = await setup();
    const before = await s.list('nope');
    await s.link();
    const after = await s.list('nope');
    expect(before.statusCode).toBe(404);
    expect(after.json()).toEqual(before.json());
    expect((await s.detailOf('nope')).json()).toEqual(before.json());
    expect((await s.detailOf('nope', 'abc')).json()).toEqual(before.json());
  });

  it('lists only shared, ended sessions with the exam title — never the session name', async () => {
    const s = await setup();
    await s.close();
    const { token } = await s.link();
    expect((await s.list(token)).json()).toEqual({ sessions: [] });
    await s.share(true);
    const body = (await s.list(token)).json<SharedSessionList>();
    expect(body.sessions).toEqual([{ id: s.session.id, examTitle: s.exam.title, startedAt: expect.any(Number), questionCount: 3 }]);
    expect(JSON.stringify(body)).not.toContain(s.session.name);
  });

  it('detail: exam order, key, explanations and the class counts; nothing about anyone', async () => {
    const s = await setup(['An', 'Bình', 'Chi']);
    await s.submit('An', { single: [0], multi: [0, 1], essay: 'bài của An' });
    await s.submit('Bình', { single: [1], multi: [0] });
    await s.submit('Chi', {});
    await s.close();
    await s.share(true);
    const { token } = await s.link();
    const res = await s.detailOf(token);
    expect(res.statusCode).toBe(200);
    const v = res.json<SharedSessionView>();
    expect(v).toMatchObject({ id: s.session.id, examTitle: s.exam.title, submitted: 3, questionCount: 3 });
    const [single, multi, essay] = v.questions;
    const o = (q: typeof s.single) => q.opts.map(x => x.id);
    expect(single!.options.map(x => x.isCorrect)).toEqual(s.single.opts.map(x => x.isCorrect));
    expect(single!.distribution).toEqual({ counts: Object.fromEntries(o(s.single).map((id, i) => [id, i === 0 || i === 1 ? 1 : 0])), blank: 1 });
    expect(multi!.distribution!.counts[s.multi.opts[0]!.id]).toBe(2);
    expect(multi!.distribution!.counts[s.multi.opts[1]!.id]).toBe(1);
    expect(multi!.distribution!.blank).toBe(1);
    expect(essay).toMatchObject({ type: 'essay', distribution: null });
    const keys = allKeys(v);
    for (const k of ['displayName', 'name', 'email', 'textAnswer', 'selectedOptionIds', 'reasonText', 'feedback', 'score', 'participantId', 'answerId']) expect(keys.has(k)).toBe(false);
    expect(JSON.stringify(v)).not.toContain('bài của An');
  });

  it('no submissions: no distribution at all; no threshold otherwise (one submission still counts)', async () => {
    const s = await setup();
    await s.close();
    await s.share(true);
    const { token } = await s.link();
    expect((await s.detailOf(token)).json<SharedSessionView>().questions.every(q => q.distribution === null)).toBe(true);

    const t = await setup();
    await t.submit('An', { single: [0] });
    await t.close();
    await t.share(true);
    const v = (await t.detailOf((await t.link()).token)).json<SharedSessionView>();
    expect(v.submitted).toBe(1);
    expect(v.questions[0]!.distribution!.counts[t.single.opts[0]!.id]).toBe(1);
  });

  it('a session that is not (or no longer) shared, or does not exist, reads as session_not_shared', async () => {
    const s = await setup();
    await s.close();
    const { token } = await s.link();
    expect((await s.detailOf(token)).json()).toMatchObject({ code: 'session_not_shared' });
    await s.share(true);
    expect((await s.detailOf(token)).statusCode).toBe(200);
    await s.share(false);
    const gone = await s.detailOf(token);
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ error: 'Phiên này không còn được chia sẻ.', code: 'session_not_shared' });
    expect((await s.detailOf(token, 999)).json()).toEqual(gone.json());
    expect((await s.detailOf(token, 'abc')).json()).toEqual(gone.json());
  });

  it("the member's review says whether the session is shared", async () => {
    const s = await setup(['An', 'Bình']);
    const v = await s.submit('Bình', { single: [0] });
    await s.close();
    const token = s.members.get('Bình')!.token;
    const review = async () => (await s.app.inject({ url: `/api/me/attempts/${v.id}/review`, headers: { 'x-participant-token': token } })).json<ReviewView>();
    expect((await review()).shared).toBe(false);
    await s.share(true);
    expect((await review()).shared).toBe(true);
  });
});
