import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { AttemptView, DiscussionView, ExamDetail, ParticipantReview, ReviewView, SessionDetail } from '../../../shared/api/index.js';
import { participants, questions } from '../../infrastructure/db/schema.js';
import { allKeys, world } from '../world.js';

// Reason box on `{reason}` multiple-choice questions (PRODUCT.md §7.32). Single (1đ) and multi (2đ) both ask for a reason.
async function setup(opts: { essay?: boolean; names?: string[] } = {}) {
  const w = await world({ essay: opts.essay ?? false, shuffle: false, state: 'lobby' });
  w.db.update(questions).set({ requireReason: true }).where(eq(questions.id, w.single.q.id)).run();
  w.db.update(questions).set({ requireReason: true }).where(eq(questions.id, w.multi.q.id)).run();
  const members = new Map([['An', w.an]]);
  for (const n of opts.names ?? []) members.set(n, w.asMember(await w.join(n)));
  await w.admin(`/sessions/${w.session.id}/start`);
  const tokenOf = (name: string) => w.db.select().from(participants).all().find(p => p.displayName === name)!.token;
  const close = () => w.admin(`/sessions/${w.session.id}/close`);
  const s1 = (i: number) => w.single.opts[i]!.id;
  const m = (i: number) => w.multi.opts[i]!.id;
  return { ...w, members, tokenOf, close, s1, m };
}

describe('saving a reason (PUT /api/me/attempts/:id/answers/:questionId)', () => {
  it('is saved with the pick, trimmed, and kept when only the pick changes', async () => {
    const w = await setup();
    const a = await w.startedAttempt(w.an);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: '  vì A đúng  ' })).statusCode).toBe(200);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(1)] })).statusCode).toBe(200);
    const view = (await w.an.get(a.id)).json<AttemptView>();
    expect(view.questions.find(q => q.id === w.single.q.id)!.requireReason).toBe(true);
    expect(view.answers.find(x => x.questionId === w.single.q.id)).toMatchObject({ selectedOptionIds: [w.s1(1)], reasonText: 'vì A đúng' });
  });

  it('caps the reason at 500 characters and refuses it on a question without {reason} or with textAnswer', async () => {
    const w = await setup({ essay: true });
    const a = await w.startedAttempt(w.an);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'x'.repeat(501) })).statusCode).toBe(400);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'x'.repeat(500) })).statusCode).toBe(200);
    expect((await w.an.put(a.id, w.essayQ!.id, { textAnswer: 'bài', reasonText: 'x' })).statusCode).toBe(400);
    w.db.update(questions).set({ requireReason: false }).where(eq(questions.id, w.multi.q.id)).run();
    const res = await w.an.put(a.id, w.multi.q.id, { selectedOptionIds: [w.m(0)], reasonText: 'x' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Câu này không hỏi lý do');
  });
});

describe('submitting with missing reasons (PRODUCT.md §7.32b)', () => {
  it('refuses a manual submit while a picked question lacks a reason, naming the questions', async () => {
    const w = await setup();
    const a = await w.startedAttempt(w.an);
    await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: '   ' });
    await w.an.put(a.id, w.multi.q.id, { selectedOptionIds: [w.m(0), w.m(1)] });
    const res = await w.an.submit(a.id);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Còn 2 câu đã chọn đáp án nhưng chưa ghi lý do', code: 'reason_missing', questionIds: [w.single.q.id, w.multi.q.id] });
    expect((await w.an.get(a.id)).json<AttemptView>().submittedAt).toBeNull();
  });

  it('submits once every pick has a reason; a question left blank needs none', async () => {
    const w = await setup();
    const a = await w.startedAttempt(w.an);
    await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'vì vậy' });
    const res = await w.an.submit(a.id);
    expect(res.statusCode).toBe(200);
    expect(res.json().attempt.score).toBe(1); // the reason never changes the score
  });

  it('closing the session still submits an attempt with missing reasons', async () => {
    const w = await setup();
    const a = await w.startedAttempt(w.an);
    await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)] });
    expect((await w.close()).statusCode).toBe(200);
    const detail = (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}`, headers: w.headers })).json<SessionDetail>();
    expect(detail.participants.find(p => p.displayName === 'An')!.progress).toMatchObject({ state: 'submitted', countedScore: 1 });
  });

  it('a reason cannot change after submitting, even while editing essays is approved', async () => {
    const w = await setup({ essay: true });
    const a = await w.startedAttempt(w.an);
    await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'bản đầu' });
    await w.an.put(a.id, w.essayQ!.id, { textAnswer: 'bài' });
    expect((await w.an.submit(a.id)).statusCode).toBe(200);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'sửa' })).statusCode).toBe(409);
    const token = w.tokenOf('An');
    await w.app.inject({ method: 'POST', url: `/api/me/attempts/${a.id}/edit-request`, headers: { 'x-participant-token': token }, payload: { reason: 'quên ý' } });
    const pid = (await w.detail()).participants.find(p => p.displayName === 'An')!.id;
    expect((await w.admin(`/participants/${pid}/edit-request/approve`)).statusCode).toBe(200);
    expect((await w.an.put(a.id, w.single.q.id, { selectedOptionIds: [w.s1(0)], reasonText: 'sửa' })).statusCode).toBe(409);
    expect((await w.an.get(a.id)).json<AttemptView>().answers.find(x => x.questionId === w.single.q.id)!.reasonText).toBe('bản đầu');
  });
});

describe('who sees reasons (PRODUCT.md §7.32e)', () => {
  async function closedWithReasons() {
    const w = await setup({ names: ['Bình', 'Chi'] });
    const picks: [string, number[], number[], string | null][] = [
      ['An', [w.s1(0)], [w.m(0), w.m(1)], 'An nghĩ A'],
      ['Bình', [w.s1(1)], [w.m(2)], 'Bình nghĩ B'],
      ['Chi', [w.s1(1)], [], null],
    ];
    const attempts = new Map<string, number>();
    for (const [name, single, multi, reason] of picks) {
      const mem = w.members.get(name)!;
      const a = await w.startedAttempt(mem);
      attempts.set(name, a.id);
      await mem.put(a.id, w.single.q.id, reason ? { selectedOptionIds: single, reasonText: reason } : { selectedOptionIds: single });
      if (multi.length) await mem.put(a.id, w.multi.q.id, { selectedOptionIds: multi, reasonText: `${name} multi` });
      if (reason) expect((await mem.submit(a.id)).statusCode).toBe(200);
    }
    await w.close(); // Chi (no reason) is auto-submitted here
    return { ...w, attempts };
  }

  it('the member review carries only their own reason', async () => {
    const w = await closedWithReasons();
    const res = await w.app.inject({ url: `/api/me/attempts/${w.attempts.get('An')}/review`, headers: { 'x-participant-token': w.tokenOf('An') } });
    expect(res.statusCode).toBe(200);
    const q = res.json<ReviewView>().questions.find(x => x.id === w.single.q.id)!;
    expect(q).toMatchObject({ requireReason: true, reasonText: 'An nghĩ A' });
    expect(res.body).not.toContain('Bình nghĩ B');
    expect(allKeys(res.json())).not.toContain('reasons');
  });

  it('the mentor sees each person reason with the name in the session review', async () => {
    const w = await closedWithReasons();
    const pid = (await w.detail()).participants.find(p => p.displayName === 'Bình')!.id;
    const r = (await w.app.inject({ url: `/api/admin/participants/${pid}/review`, headers: w.headers })).json<ParticipantReview>();
    expect(r.attempt!.questions.find(x => x.id === w.single.q.id)!.reasonText).toBe('Bình nghĩ B');
  });

  it('the discussion lists every pick anonymously with its reason, in a stable order', async () => {
    const w = await closedWithReasons();
    const get = async () => (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}/discussion`, headers: w.headers })).json<DiscussionView>();
    const v = await get();
    const single = v.questions.find(q => q.id === w.single.q.id)!;
    expect(single.requireReason).toBe(true);
    expect([...single.reasons].sort((x, y) => String(x.text).localeCompare(String(y.text)))).toEqual([
      { optionIds: [w.s1(0)], text: 'An nghĩ A' },
      { optionIds: [w.s1(1)], text: 'Bình nghĩ B' },
      { optionIds: [w.s1(1)], text: null },
    ]);
    const multi = v.questions.find(q => q.id === w.multi.q.id)!;
    expect(multi.reasons).toHaveLength(2); // Chi left the multi question blank
    expect(multi.reasons.find(r => r.text === 'An multi')!.optionIds).toEqual([w.m(0), w.m(1)].sort((a, b) => a - b));
    const keys = allKeys(v);
    for (const k of ['participantId', 'attemptId', 'displayName', 'name']) expect(keys).not.toContain(k);
    expect((await get()).questions.map(q => q.reasons)).toEqual(v.questions.map(q => q.reasons));
  });

  it('member and public endpoints never carry the class reasons', async () => {
    const w = await closedWithReasons();
    const urls = [`/api/sessions/${w.session.id}/leaderboard`, `/api/sessions/${w.session.id}/public`, `/api/sessions/${w.session.id}/participants`];
    for (const url of urls) {
      const res = await w.app.inject({ url });
      expect(res.body, url).not.toContain('nghĩ');
    }
    const me = await w.an.me();
    expect(me.body).not.toContain('Bình nghĩ B');
  });
});

describe('exam detail (mentor preview)', () => {
  it('imports {reason} and shows it on the question', async () => {
    const w = await world();
    const md = '---\ntitle: R\n---\n\n## Q {reason}\n- [x] a\n- [ ] b\n> vì\n';
    const res = await w.app.inject({ method: 'POST', url: '/api/admin/exams', headers: w.headers, payload: { markdown: md } });
    expect(res.statusCode).toBe(201);
    const detail = (await w.app.inject({ url: `/api/admin/exams/${res.json().exam.id}`, headers: w.headers })).json<ExamDetail>();
    expect(detail.questions[0]!.requireReason).toBe(true);
  });
});
