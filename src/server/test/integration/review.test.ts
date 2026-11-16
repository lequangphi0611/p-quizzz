import { describe, expect, it } from 'vitest';
import type { AttemptView, ReviewView } from '../../../shared/api/index.js';
import { allKeys, KEY_LEAKS, world } from '../world.js';

// Members join in the lobby (so they are `active`), then the session starts. `tokenOf` holds each token for direct calls.
async function lobbyWorld(opts: { essay?: boolean } = {}) {
  const w = await world({ essay: opts.essay ?? false, shuffle: false, state: 'lobby' });
  const tokenOf = new Map<string, string>();
  const join = async (name: string) => { const t = await w.join(name); tokenOf.set(name, t); return w.asMember(t); };
  const bao = await join('Bảo');
  const chi = await join('Chi');
  await w.admin(`/sessions/${w.session.id}/start`);
  const reviewAs = (token: string, attemptId: number | string) => w.app.inject({ url: `/api/me/attempts/${attemptId}/review`, headers: { 'x-participant-token': token } });
  return { ...w, bao, chi, tokenOf, reviewAs, close: () => w.admin(`/sessions/${w.session.id}/close`) };
}

describe('GET /api/me/attempts/:id/review', () => {
  it('403 while the session is running — for an open attempt and for a submitted one', async () => {
    const w = await lobbyWorld();
    const token = w.tokenOf.get('Bảo')!;
    const v = (await w.bao.start()).json<AttemptView>();
    const open = await w.reviewAs(token, v.id);
    expect(open.statusCode).toBe(403);
    expect(open.json()).toEqual({ error: 'Đáp án sẽ hiện khi phiên thi kết thúc' });
    await w.bao.submit(v.id);
    expect((await w.reviewAs(token, v.id)).statusCode).toBe(403); // submitted, session still running (retakes possible)
    for (const k of KEY_LEAKS) expect((await w.reviewAs(token, v.id)).body).not.toContain(k);
  });

  it('401 without a token; 404 for an unknown or malformed attempt', async () => {
    const w = await lobbyWorld();
    expect((await w.app.inject({ url: '/api/me/attempts/1/review' })).statusCode).toBe(401);
    await w.close();
    const token = w.tokenOf.get('Bảo')!;
    expect((await w.reviewAs(token, 99999)).statusCode).toBe(404);
    expect((await w.reviewAs(token, 'abc')).statusCode).toBe(404);
  });

  it("after the close: the member's answers, the key, scores and explanations, in the order they saw them", async () => {
    const w = await lobbyWorld();
    const token = w.tokenOf.get('Bảo')!;
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[1]!.id] }); // wrong (B)
    // multi left blank
    await w.bao.submit(v.id);
    await w.close(); // multiple-choice exam → finalized right away

    const res = await w.reviewAs(token, v.id);
    expect(res.statusCode).toBe(200);
    const r = res.json<ReviewView>();
    expect(r).toMatchObject({ attemptId: v.id, attemptNo: 1, score: 0, maxScore: 3, official: true });
    expect(r.questions.map(q => q.id)).toEqual(v.questions.map(q => q.id)); // same order as the attempt
    const single = r.questions.find(q => q.id === w.single.q.id)!;
    expect(single.options.map(o => [o.text, o.isCorrect])).toEqual([['A', true], ['B', false]]);
    expect(single).toMatchObject({ selectedOptionIds: [w.single.opts[1]!.id], score: 0, points: 1 });
    const multi = r.questions.find(q => q.id === w.multi.q.id)!;
    expect(multi.options.filter(o => o.isCorrect)).toHaveLength(2);
    expect(multi).toMatchObject({ selectedOptionIds: null, score: 0 });
  });

  it('a correct choice shows its points; explanations are included', async () => {
    const w = await lobbyWorld();
    const { db } = w;
    const { questions } = await import('../../infrastructure/db/schema.js');
    db.update(questions).set({ explanation: 'Vì A đúng' }).run();
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
    await w.bao.put(v.id, w.multi.q.id, { selectedOptionIds: [w.multi.opts[0]!.id, w.multi.opts[1]!.id] });
    await w.bao.submit(v.id);
    await w.close();
    const r = (await w.reviewAs(w.tokenOf.get('Bảo')!, v.id)).json<ReviewView>();
    expect(r.score).toBe(3);
    expect(r.questions.map(q => [q.score, q.explanation])).toEqual(expect.arrayContaining([[1, 'Vì A đúng'], [2, 'Vì A đúng']]));
  });

  it("a member can only review their own attempt (404 for someone else's), and still cannot before the close", async () => {
    const w = await lobbyWorld();
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.submit(v.id);
    const chiToken = w.tokenOf.get('Chi')!;
    await w.close();

    const res = await w.reviewAs(chiToken, v.id); // Chi asks for Bảo's attempt
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Không tìm thấy lượt làm bài' });
    expect(res.body).not.toContain('isCorrect');
    expect((await w.reviewAs(w.tokenOf.get('Bảo')!, v.id)).statusCode).toBe(200); // the owner can
  });

  it('a kicked member gets 403 from the participant guard, not the key', async () => {
    const w = await lobbyWorld();
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.submit(v.id);
    const detail = (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}`, headers: w.headers })).json<{ participants: { id: number; displayName: string }[] }>();
    await w.admin(`/participants/${detail.participants.find(p => p.displayName === 'Bảo')!.id}/kick`);
    await w.close();
    const res = await w.reviewAs(w.tokenOf.get('Bảo')!, v.id);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Bạn đã bị mời ra khỏi phiên' });
  });
});

describe('review of an exam with an essay', () => {
  it('before grading: essay score is null and the rubric is shown; after grading + finalize: score and feedback appear and count', async () => {
    const w = await lobbyWorld({ essay: true });
    const token = w.tokenOf.get('Bảo')!;
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
    await w.bao.put(v.id, w.essayQ!.id, { textAnswer: 'bài làm của Bảo' });
    await w.bao.submit(v.id);
    await w.close();

    let r = (await w.reviewAs(token, v.id)).json<ReviewView>();
    expect(r).toMatchObject({ official: false, score: 1, maxScore: 7 });
    const essay = () => r.questions.find(q => q.type === 'essay')!;
    expect(essay()).toMatchObject({ textAnswer: 'bài làm của Bảo', score: null, feedback: null, options: [] });

    // the mentor grades the member's essay (An, who never played, has no counted attempt and needs no grade)
    const grading = (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}/grading`, headers: w.headers })).json<{ questions: { answers: { answerId: number; displayName: string }[] }[] }>();
    const id = grading.questions[0]!.answers.find(a => a.displayName === 'Bảo')!.answerId;
    await w.app.inject({ method: 'PUT', url: `/api/admin/answers/${id}/grade`, headers: w.headers, payload: { score: 3.5, feedback: 'Thiếu rủi ro rebase' } });
    expect((await w.admin(`/sessions/${w.session.id}/finalize`)).statusCode).toBe(200);

    r = (await w.reviewAs(token, v.id)).json<ReviewView>();
    expect(r).toMatchObject({ official: true, score: 4.5, maxScore: 7 });
    expect(essay()).toMatchObject({ score: 3.5, feedback: 'Thiếu rủi ro rebase' });
  });
});

describe('the answer key stays out of the earlier endpoints', () => {
  it('start / get / me still carry no isCorrect or explanation, even in a session that has already closed', async () => {
    const w = await lobbyWorld();
    const v = (await w.bao.start()).json<AttemptView>();
    await w.bao.submit(v.id);
    await w.close();
    for (const res of [await w.bao.get(v.id), await w.bao.me()]) {
      const keys = allKeys(JSON.parse(res.body));
      for (const k of KEY_LEAKS) expect(keys.has(k), k).toBe(false); // only /review reveals the key
    }
  });
});
