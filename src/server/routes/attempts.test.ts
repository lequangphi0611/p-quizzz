import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { AttemptView, MeResponse, SubmitResponse } from '../../shared/api/index.js';
import { answers, attempts, questions } from '../db/schema.js';
import { bus } from '../events.js';
import { joinAs, roomCodeOf, seedExam } from '../test/helpers.js';
import { allKeys, KEY_LEAKS, world } from '../test/world.js';

describe('POST /api/me/attempts — starting', () => {
  it('needs a participant token', async () => {
    const { app } = await world();
    expect((await app.inject({ method: 'POST', url: '/api/me/attempts' })).statusCode).toBe(401);
  });

  it('is refused while the session is still in the lobby', async () => {
    const { an } = await world({ state: 'lobby' });
    const res = await an.start();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Phiên thi chưa bắt đầu hoặc đã đóng' });
  });

  it('is refused for a member still waiting for approval', async () => {
    const { join, asMember } = await world();
    const late = asMember(await join('Trễ')); // joined after start → pending
    const res = await late.start();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Bạn đang chờ mentor duyệt' });
  });

  it('creates attempt #1 with questions, options and no answers saved', async () => {
    const { an, single, multi } = await world();
    const res = await an.start();
    expect(res.statusCode).toBe(201);
    const v = res.json<AttemptView>();
    expect(v).toMatchObject({ attemptNo: 1, submittedAt: null, answers: [] });
    expect(v.questions).toHaveLength(2);
    const sq = v.questions.find(q => q.id === single.q.id)!;
    expect(sq).toMatchObject({ type: 'single', prompt: 'Single?', points: 1 });
    expect(sq.options.map(o => o.text).sort()).toEqual(['A', 'B']);
    expect(v.questions.find(q => q.id === multi.q.id)!.options).toHaveLength(3);
  });

  it('only one unfinished attempt at a time', async () => {
    const { an } = await world();
    await an.start();
    const res = await an.start();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Bạn đang có một lượt làm dở' });
  });
});

describe('shuffling', () => {
  it('shuffle=false keeps the exam order for questions and options', async () => {
    const { an, single, multi } = await world({ shuffle: false });
    const v = (await an.start()).json<AttemptView>();
    expect(v.questions.map(q => q.id)).toEqual([single.q.id, multi.q.id]);
    expect(v.questions[0]!.options.map(o => o.id)).toEqual(single.opts.map(o => o.id));
    expect(v.questions[1]!.options.map(o => o.id)).toEqual(multi.opts.map(o => o.id));
  });

  it('shuffle=true gives permutations of the same content, and members differ', async () => {
    const w = await world({ shuffle: true, state: 'lobby' });
    const tokens = await Promise.all(Array.from({ length: 14 }, (_, i) => w.join(`m${i}`)));
    await w.admin(`/sessions/${w.session.id}/start`);
    const orders = new Set<string>();
    for (const t of tokens) {
      const v = (await w.asMember(t).start()).json<AttemptView>();
      expect([...v.questions.map(q => q.id)].sort()).toEqual([w.single.q.id, w.multi.q.id].sort());
      expect([...v.questions.find(q => q.id === w.multi.q.id)!.options.map(o => o.id)].sort()).toEqual(w.multi.opts.map(o => o.id).sort());
      orders.add(v.questions.map(q => q.id).join(',') + '|' + v.questions.map(q => q.options.map(o => o.id).join('.')).join('/'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('the order is fixed for an attempt: reading it again returns the same order (F5)', async () => {
    const { an } = await world();
    const started = (await an.start()).json<AttemptView>();
    const again = (await an.get(started.id)).json<AttemptView>();
    expect(again.questions).toEqual(started.questions);
  });
});

describe('one attempt per session (PRODUCT.md §4.4)', () => {
  const refusal = { error: 'Bạn đã nộp bài. Muốn làm lại, nhờ mentor mở phiên thi mới' };

  it.each([['multiple-choice exam', false], ['exam with essays', true]])('%s: a second attempt is refused once the first is submitted', async (_name, essay) => {
    const { an } = await world({ essay });
    const v = (await an.start()).json<AttemptView>();
    expect(v.attemptNo).toBe(1);
    await an.submit(v.id);
    const res = await an.start();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(refusal);
    expect((await an.me()).json<MeResponse>().attempt.submitted).toHaveLength(1); // nothing was created
  });

  it('a second start while the first is still open is refused too', async () => {
    const { an } = await world();
    await an.start();
    const res = await an.start();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Bạn đang có một lượt làm dở' });
  });

  it('a new session lets everyone play again: the same member joins it and gets a fresh attempt #1', async () => {
    const w = await world({ essay: false, state: 'lobby' });
    const firstToken = await w.join('Dũng');
    await w.admin(`/sessions/${w.session.id}/start`);
    const first = w.asMember(firstToken);
    await first.submit(((await first.start()).json<AttemptView>()).id);
    await w.admin(`/sessions/${w.session.id}/close`); // multiple-choice → finalized

    const next = (await w.admin('/sessions', { examId: w.exam.id })).json<{ id: number }>();
    await w.admin(`/sessions/${next.id}/open`);
    const token = await joinAs(w.app, next.id, 'Dũng'); // lobby: the helper approves like the mentor
    await w.admin(`/sessions/${next.id}/start`);
    const again = w.asMember(token);
    const v = (await again.start()).json<AttemptView>();
    expect(v.attemptNo).toBe(1);
    expect((await again.submit(v.id)).statusCode).toBe(200);
  });
});

describe('PUT answers — autosave', () => {
  it('saves a choice and an essay text, and GET returns them (progress survives F5)', async () => {
    const { an, single, essayQ } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[1]!.id] })).json()).toEqual({ ok: true });
    await an.put(v.id, essayQ!.id, { textAnswer: 'merge giữ lịch sử' });
    const back = (await an.get(v.id)).json<AttemptView>();
    expect(back.answers).toEqual(expect.arrayContaining([
      { questionId: single.q.id, selectedOptionIds: [single.opts[1]!.id], textAnswer: null },
      { questionId: essayQ!.id, selectedOptionIds: null, textAnswer: 'merge giữ lịch sử' },
    ]));
  });

  it('saving again overwrites (one row per question), an empty selection clears, duplicates collapse', async () => {
    const { an, db, multi } = await world();
    const v = (await an.start()).json<AttemptView>();
    const [o1, o2] = multi.opts;
    await an.put(v.id, multi.q.id, { selectedOptionIds: [o1!.id] });
    await an.put(v.id, multi.q.id, { selectedOptionIds: [o1!.id, o2!.id, o2!.id] });
    expect(db.select().from(answers).where(eq(answers.attemptId, v.id)).all()).toHaveLength(1);
    expect((await an.get(v.id)).json<AttemptView>().answers[0]!.selectedOptionIds).toEqual([o1!.id, o2!.id]);
    await an.put(v.id, multi.q.id, { selectedOptionIds: [] });
    expect((await an.get(v.id)).json<AttemptView>().answers[0]!.selectedOptionIds).toEqual([]);
  });

  it('400: a question that is not part of the attempt, or does not exist', async () => {
    const { an, db } = await world();
    const v = (await an.start()).json<AttemptView>();
    const other = seedExam(db, { title: 'Other' });
    const foreign = db.select().from(questions).where(eq(questions.examId, other.id)).all()[0]!;
    const res = await an.put(v.id, foreign.id, { selectedOptionIds: [] });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Câu hỏi không thuộc lượt làm bài này' });
    expect((await an.put(v.id, 99999, { selectedOptionIds: [] })).statusCode).toBe(400);
  });

  it('400: an option that belongs to another question', async () => {
    const { an, single, multi } = await world();
    const v = (await an.start()).json<AttemptView>();
    const res = await an.put(v.id, single.q.id, { selectedOptionIds: [multi.opts[0]!.id] });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Đáp án không thuộc câu hỏi này' });
  });

  it('400: single choice with two options; wrong payload kind for the question type; bad shapes', async () => {
    const { an, single, multi, essayQ } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    const both = single.opts.map(o => o.id);
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: both })).json()).toEqual({ error: 'Câu một đáp án chỉ được chọn tối đa 1' });
    expect((await an.put(v.id, multi.q.id, { selectedOptionIds: multi.opts.map(o => o.id) })).statusCode).toBe(200); // multi may take several
    expect((await an.put(v.id, essayQ!.id, { selectedOptionIds: [] })).statusCode).toBe(400);
    expect((await an.put(v.id, single.q.id, { textAnswer: 'x' })).statusCode).toBe(400);
    expect((await an.put(v.id, single.q.id, {})).statusCode).toBe(400);
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id], textAnswer: 'x' })).statusCode).toBe(400);
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: ['a'] })).statusCode).toBe(400);
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: [-1] })).statusCode).toBe(400);
  });

  it('essay text: 10,000 characters is fine, 10,001 is rejected', async () => {
    const { an, essayQ } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    expect((await an.put(v.id, essayQ!.id, { textAnswer: 'x'.repeat(10_000) })).statusCode).toBe(200);
    const res = await an.put(v.id, essayQ!.id, { textAnswer: 'x'.repeat(10_001) });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Câu trả lời tối đa 10.000 ký tự' });
  });

  it('409 after the attempt is submitted', async () => {
    const { an, single } = await world();
    const v = (await an.start()).json<AttemptView>();
    await an.submit(v.id);
    const res = await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Lượt này đã nộp' });
  });
});

describe('ownership', () => {
  it("another member cannot read, save into or submit someone else's attempt (404)", async () => {
    const { an, asMember, join, single, session, admin } = await world({ state: 'lobby' });
    const bao = asMember(await join('Bảo'));
    await admin(`/sessions/${session.id}/start`);
    const v = (await an.start()).json<AttemptView>();
    expect((await bao.get(v.id)).statusCode).toBe(404);
    expect((await bao.put(v.id, single.q.id, { selectedOptionIds: [] })).statusCode).toBe(404);
    expect((await bao.submit(v.id)).statusCode).toBe(404);
    expect((await an.get(99999)).statusCode).toBe(404);
    expect((await an.get(NaN as unknown as number)).statusCode).toBe(404);
  });
});

describe('POST submit — scoring', () => {
  it('multiple-choice exam: scores every question, a blank one is 0', async () => {
    const { an, single, multi, db } = await world();
    const v = (await an.start()).json<AttemptView>();
    await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] }); // right
    // multi left blank
    const res = await an.submit(v.id);
    expect(res.statusCode).toBe(200);
    const out = res.json<SubmitResponse>();
    expect(out).toMatchObject({ essayPending: false, attempt: { attemptNo: 1, score: 1, maxScore: 3 } });
    const rows = db.select().from(answers).where(eq(answers.attemptId, v.id)).all();
    expect(rows).toHaveLength(2); // blank questions still get a row
    expect(rows.find(r => r.questionId === multi.q.id)).toMatchObject({ autoScore: 0, selectedOptionIds: null });
    expect(db.select().from(attempts).where(eq(attempts.id, v.id)).get()!.autoScore).toBe(1);
  });

  it('multi must match the key exactly: all right → points; one extra → 0', async () => {
    const w = await world({ state: 'lobby' });
    const bao = w.asMember(await w.join('Bảo')); // "An" is the other member
    await w.admin(`/sessions/${w.session.id}/start`);
    const right = (await w.an.start()).json<AttemptView>();
    await w.an.put(right.id, w.multi.q.id, { selectedOptionIds: [w.multi.opts[0]!.id, w.multi.opts[1]!.id] });
    expect((await w.an.submit(right.id)).json<SubmitResponse>().attempt.score).toBe(2);
    const extra = (await bao.start()).json<AttemptView>();
    await bao.put(extra.id, w.multi.q.id, { selectedOptionIds: w.multi.opts.map(o => o.id) });
    expect((await bao.submit(extra.id)).json<SubmitResponse>().attempt.score).toBe(0);
  });

  it('exam with essays: essay has no automatic score; maxScore covers choice questions only; essay row exists for grading', async () => {
    const { an, single, multi, essayQ, db } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] });
    await an.put(v.id, multi.q.id, { selectedOptionIds: [multi.opts[0]!.id, multi.opts[1]!.id] });
    await an.put(v.id, essayQ!.id, { textAnswer: 'bài làm' });
    const out = (await an.submit(v.id)).json<SubmitResponse>();
    expect(out).toMatchObject({ essayPending: true, attempt: { score: 3, maxScore: 3 } });
    const essayRow = db.select().from(answers).where(eq(answers.attemptId, v.id)).all().find(r => r.questionId === essayQ!.id)!;
    expect(essayRow).toMatchObject({ autoScore: null, manualScore: null, textAnswer: 'bài làm' });
  });

  it('a second submit → 409', async () => {
    const { an } = await world();
    const v = (await an.start()).json<AttemptView>();
    await an.submit(v.id);
    const res = await an.submit(v.id);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Lượt này đã nộp' });
  });
});

describe('GET /api/me — attempt state', () => {
  it('canStartNew: false in the lobby, true when running, false with an attempt open', async () => {
    const lobby = await world({ state: 'lobby' });
    expect((await lobby.an.me()).json<MeResponse>().attempt).toEqual({ current: null, submitted: [], canStartNew: false });
    await lobby.admin(`/sessions/${lobby.session.id}/start`);
    expect((await lobby.an.me()).json<MeResponse>().attempt.canStartNew).toBe(true);
    const v = (await lobby.an.start()).json<AttemptView>();
    const open = (await lobby.an.me()).json<MeResponse>().attempt;
    expect(open.current).toMatchObject({ id: v.id, attemptNo: 1 });
    expect(open.canStartNew).toBe(false);
  });

  it('lists the submitted attempt, and no further attempt can be started — for any exam type', async () => {
    for (const essay of [false, true]) {
      const w = await world({ essay });
      const v = (await w.an.start()).json<AttemptView>();
      await w.an.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
      await w.an.submit(v.id);
      const a = (await w.an.me()).json<MeResponse>().attempt;
      expect(a.current).toBeNull();
      expect(a.submitted).toEqual([{ id: v.id, attemptNo: 1, submittedAt: expect.any(Number), score: 1, maxScore: 3, essayScore: null }]);
      expect(a.canStartNew).toBe(false);
    }
  });
});

describe('closing the session', () => {
  it('submits and scores an attempt that is still open, with its saved answers', async () => {
    const { an, single, admin, session, detail } = await world({ essay: false });
    const v = (await an.start()).json<AttemptView>();
    await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] });
    await admin(`/sessions/${session.id}/close`);

    const done = (await an.get(v.id)).json<AttemptView>();
    expect(done.submittedAt).not.toBeNull();
    const me = (await an.me()).json<MeResponse>().attempt;
    expect(me.current).toBeNull();
    expect(me.submitted[0]).toMatchObject({ score: 1, maxScore: 3 });
    expect((await detail()).participants[0]!.progress).toMatchObject({ state: 'submitted', countedScore: 1 });
  });

  it("leaves a kicked member's open attempt alone", async () => {
    const { an, admin, session, detail, db } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    const pid = (await detail()).participants[0]!.id;
    await admin(`/participants/${pid}/kick`);
    await admin(`/sessions/${session.id}/close`);
    expect(db.select().from(attempts).where(eq(attempts.id, v.id)).get()!.submittedAt).toBeNull();
  });

  it('after the close, saving or submitting is refused', async () => {
    const { an, single, admin, session } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    await admin(`/sessions/${session.id}/close`);
    expect((await an.put(v.id, single.q.id, { selectedOptionIds: [] })).statusCode).toBe(409);
    expect((await an.submit(v.id)).statusCode).toBe(409);
    expect((await an.start()).statusCode).toBe(409);
  });
});

describe('mentor progress (GET /api/admin/sessions/:id)', () => {
  it('none → doing → submitted, with the counted score', async () => {
    const { an, single, multi, detail } = await world({ essay: false });
    const progress = async () => (await detail()).participants[0]!.progress;
    expect(await progress()).toEqual({ state: 'none', attempts: 0, countedScore: null, maxScore: 3, submittedAt: null });

    const v = (await an.start()).json<AttemptView>();
    expect(await progress()).toMatchObject({ state: 'doing', attempts: 1, countedScore: null, submittedAt: null });
    await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] });
    await an.put(v.id, multi.q.id, { selectedOptionIds: [multi.opts[0]!.id, multi.opts[1]!.id] });
    const before = Date.now();
    await an.submit(v.id); // 1 + 2 points
    const done = await progress();
    expect(done).toMatchObject({ state: 'submitted', attempts: 1, countedScore: 3 });
    expect(done.submittedAt).toBeGreaterThanOrEqual(before);
    expect(done.submittedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('realtime signals', () => {
  it('start → participants; submit → leaderboard + participants; closing with open work → leaderboard', async () => {
    const w = await world({ essay: false, state: 'lobby' });
    const { an, admin, session } = w;
    const bao = w.asMember(await w.join('Bảo'));
    await admin(`/sessions/${session.id}/start`);
    const seen: string[] = [];
    const off = bus.subscribe(session.id, t => seen.push(t));
    const v = (await an.start()).json<AttemptView>();
    expect(seen).toEqual(['participants']);
    seen.length = 0;
    await an.submit(v.id);
    expect(seen.sort()).toEqual(['leaderboard', 'participants']);

    await bao.start(); // still open when the mentor closes
    seen.length = 0;
    await admin(`/sessions/${session.id}/close`);
    expect(seen).toEqual(expect.arrayContaining(['session', 'leaderboard']));
    off();
  });

  it('rejected actions publish nothing', async () => {
    const { an, session } = await world({ essay: true });
    const v = (await an.start()).json<AttemptView>();
    await an.submit(v.id);
    const seen: string[] = [];
    const off = bus.subscribe(session.id, t => seen.push(t));
    await an.start(); // 409: essay exam, already used its attempt
    await an.submit(v.id); // 409: already submitted
    off();
    expect(seen).toEqual([]);
  });
});

describe('⚠️ the answer key never reaches a member before the session closes', () => {
  it('no /api/me/* response contains isCorrect, is_correct or explanation', async () => {
    const { an, db, single, multi, essayQ } = await world({ essay: true });
    // Give every question an explanation so a leak would be visible.
    db.update(questions).set({ explanation: 'SECRET-EXPLANATION' }).run();
    const bodies: { name: string; body: string }[] = [];
    const rec = (name: string, res: { body: string }) => { bodies.push({ name, body: res.body }); return res; };

    rec('me (before)', await an.me());
    const started = rec('start', await an.start());
    const v = started.body ? (JSON.parse(started.body) as AttemptView) : null!;
    rec('get', await an.get(v.id));
    rec('put choice', await an.put(v.id, single.q.id, { selectedOptionIds: [single.opts[0]!.id] }));
    rec('put multi', await an.put(v.id, multi.q.id, { selectedOptionIds: [multi.opts[0]!.id] }));
    rec('put essay', await an.put(v.id, essayQ!.id, { textAnswer: 'x' }));
    rec('get (saved)', await an.get(v.id));
    rec('me (open)', await an.me());
    rec('submit', await an.submit(v.id));
    rec('me (after)', await an.me());
    rec('get (submitted)', await an.get(v.id));
    rec('error: bad option', await an.put(v.id, single.q.id, { selectedOptionIds: [999999] }));

    for (const { name, body } of bodies) {
      const keys = allKeys(JSON.parse(body));
      for (const k of KEY_LEAKS) expect(keys.has(k), `${name} leaked key "${k}"`).toBe(false);
      expect(body, `${name} leaked an explanation`).not.toContain('SECRET-EXPLANATION');
      expect(keys.has('autoScore') || keys.has('manualScore') || keys.has('feedback'), `${name} leaked a per-question score`).toBe(false);
    }
  });

  it('the structure of a question really is only id/type/prompt/body/points/options{id,text}', async () => {
    const { an } = await world();
    const v = (await an.start()).json<AttemptView>();
    for (const q of v.questions) {
      expect(Object.keys(q).sort()).toEqual(['body', 'id', 'options', 'points', 'prompt', 'type']);
      for (const o of q.options) expect(Object.keys(o).sort()).toEqual(['id', 'text']);
    }
  });
});
