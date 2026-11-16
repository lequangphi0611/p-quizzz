import { describe, expect, it } from 'vitest';
import type { AttemptView, DiscussionView, SessionDetail } from '../../../shared/api/index.js';
import { allKeys, world } from '../world.js';

type Pick = { single?: number[]; multi?: number[]; essay?: string | null };

// Essay exam (single 1đ correct = opt 0 · multi 2đ correct = opts 0+1 · essay 4đ). Members join in the lobby, then it starts.
async function setup(names: string[]) {
  const w = await world({ essay: true, shuffle: false, state: 'lobby' });
  const members = new Map<string, ReturnType<typeof w.asMember>>([['An', w.an]]);
  for (const n of names.filter(n => n !== 'An')) members.set(n, w.asMember(await w.join(n)));
  await w.admin(`/sessions/${w.session.id}/start`);
  const opt = (q: 'single' | 'multi', i: number) => w[q].opts[i]!.id;
  const submit = async (name: string, p: Pick) => {
    const m = members.get(name)!;
    const v = (await m.start()).json<AttemptView>();
    if (p.single) await m.put(v.id, w.single.q.id, { selectedOptionIds: p.single.map(i => opt('single', i)) });
    if (p.multi) await m.put(v.id, w.multi.q.id, { selectedOptionIds: p.multi.map(i => opt('multi', i)) });
    if (p.essay != null) await m.put(v.id, w.essayQ!.id, { textAnswer: p.essay });
    await m.submit(v.id);
  };
  const url = `/api/admin/sessions/${w.session.id}/discussion`;
  const get = (extra: { headers?: Record<string, string>; remoteAddress?: string } = {}) => w.app.inject({ url, headers: extra.headers ?? w.headers, remoteAddress: extra.remoteAddress });
  const view = async () => (await get()).json<DiscussionView>();
  const detail = async () => (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}`, headers: w.headers })).json<SessionDetail>();
  const idOf = async (name: string) => (await detail()).participants.find(p => p.displayName === name)!.id;
  return { ...w, members, submit, get, view, idOf, close: () => w.admin(`/sessions/${w.session.id}/close`) };
}

describe('GET /api/admin/sessions/:id/discussion', () => {
  it('needs the mentor cookie and the mentor machine; 404 for an unknown session', async () => {
    const s = await setup(['An']);
    await s.close();
    expect((await s.get({ headers: {} })).statusCode).toBe(401);
    expect((await s.get({ remoteAddress: '192.168.1.50' })).statusCode).toBe(403);
    expect((await s.app.inject({ url: '/api/admin/sessions/999/discussion', headers: s.headers })).statusCode).toBe(404);
  });

  it('only once the session is closed (or finalized)', async () => {
    const s = await setup(['An']);
    const res = await s.get();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Chỉ thảo luận được sau khi đóng phiên' });
    await s.close();
    expect((await s.get()).statusCode).toBe(200);
  });

  it('counts picks per option, full-mark answers and blanks — single and multi', async () => {
    const s = await setup(['An', 'Bình', 'Chi', 'Dũng']);
    await s.submit('An', { single: [0], multi: [0, 1], essay: 'a' });
    await s.submit('Bình', { single: [1], multi: [0], essay: 'b' });
    await s.submit('Chi', { single: [0], multi: [0, 1, 2], essay: '   ' });
    await s.submit('Dũng', {}); // blank everywhere
    await s.close();
    const v = await s.view();
    expect(v).toMatchObject({ status: 'closed', submitted: 4, graded: 0, total: 4 });
    const [single, multi, essay] = v.questions;
    expect(single!.options.map(o => [o.count, o.isCorrect])).toEqual([[2, true], [1, false], ...single!.options.slice(2).map(() => [0, false])]);
    expect(single).toMatchObject({ type: 'single', correctCount: 2, blankCount: 1, answers: [] });
    expect(multi!.options.slice(0, 3).map(o => o.count)).toEqual([3, 2, 1]);
    expect(multi).toMatchObject({ type: 'multi', correctCount: 1, blankCount: 1 }); // only An has exactly {0,1}
    expect(essay).toMatchObject({ type: 'essay', options: [], correctCount: 0, blankCount: 2 });
    expect(essay!.answers).toHaveLength(4); // blanks are listed too, so they can be graded
    expect(essay!.answers.map(a => a.label).sort()).toEqual(['Bài #1', 'Bài #2', 'Bài #3', 'Bài #4']);
  });

  it('kicked members, pending latecomers and people who never submitted are not counted', async () => {
    const s = await setup(['An', 'Bình', 'Chi']);
    await s.submit('An', { single: [0] });
    await s.submit('Bình', { single: [1] });
    await s.members.get('Chi')!.start(); // never submits; closing auto-submits the open attempt
    const late = await s.join('Muộn'); // pending: cannot start
    expect(late).toBeTruthy();
    await s.admin(`/participants/${await s.idOf('Bình')}/kick`);
    await s.close();
    const v = await s.view();
    // An + Chi (auto-submitted on close); Bình is kicked, Muộn is pending.
    expect(v.submitted).toBe(2);
    expect(v.questions[0]!.options[0]!.count).toBe(1);
    expect(v.questions[0]!.options[1]!.count).toBe(0);
    expect(v.questions[0]!.blankCount).toBe(1);
  });

  it('never carries anything that identifies the author', async () => {
    const s = await setup(['An', 'Bình']);
    await s.submit('An', { essay: 'x' });
    await s.submit('Bình', { essay: 'y' });
    await s.close();
    const res = await s.get();
    const keys = allKeys(res.json());
    for (const k of ['displayName', 'participantId', 'attemptId', 'name', 'token', 'joinedAt', 'submittedAt']) expect(keys.has(k)).toBe(false);
    expect(res.body).not.toContain('Bình');
  });

  it('anonymous order is stable across reloads and not the join order', async () => {
    const names = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà'];
    const s = await setup(names);
    for (const n of names) await s.submit(n, { essay: `bài của ${n}` });
    await s.close();
    const a = (await s.view()).questions[2]!.answers;
    const b = (await s.view()).questions[2]!.answers;
    expect(b).toEqual(a);
    expect(a.map(x => x.textAnswer)).not.toEqual(names.map(n => `bài của ${n}`)); // join order
    expect(a.map(x => x.answerId)).not.toEqual([...a.map(x => x.answerId)].sort((x, y) => x - y)); // id order
  });

  it('grading from the discussion shows up in it; finalized stays readable', async () => {
    const s = await setup(['An']);
    await s.submit('An', { essay: 'merge vs rebase' });
    await s.close();
    const ans = (await s.view()).questions[2]!.answers[0]!;
    const g = await s.app.inject({ method: 'PUT', url: `/api/admin/answers/${ans.answerId}/grade`, headers: s.headers, payload: { score: 3.5, feedback: 'ok' } });
    expect(g.statusCode).toBe(200);
    expect((await s.view())).toMatchObject({ graded: 1, total: 1 });
    expect((await s.view()).questions[2]!.answers[0]).toMatchObject({ manualScore: 3.5, feedback: 'ok' });
    expect((await s.admin(`/sessions/${s.session.id}/finalize`)).statusCode).toBe(200);
    expect((await s.view()).status).toBe('finalized');
  });
});
