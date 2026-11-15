import { describe, expect, it } from 'vitest';
import type { AttemptView, GradeResponse, GradingView, LeaderboardResponse, MeResponse, SessionDetail } from '../../shared/api/index.js';
import { answers } from '../db/schema.js';
import { bus } from '../events.js';
import { world } from '../test/world.js';

// An essay exam (essay = 4 points; single 1 + multi 2 are auto-graded). Members join in the lobby, the session
// starts, everyone with a text submits; a null text means the member submits without writing the essay.
async function setup(opts: { names?: string[] } = {}) {
  const names = opts.names ?? ['An', 'Bình', 'Chi'];
  const w = await world({ essay: true, state: 'lobby', shuffle: false });
  const members = new Map<string, ReturnType<typeof w.asMember>>();
  for (const n of names) members.set(n, n === 'An' ? w.an : w.asMember(await w.join(n)));
  await w.admin(`/sessions/${w.session.id}/start`);

  const submit = async (name: string, essay: string | null, rightChoices = true) => {
    const m = members.get(name)!;
    const v = (await m.start()).json<AttemptView>();
    if (rightChoices) {
      await m.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
      await m.put(v.id, w.multi.q.id, { selectedOptionIds: [w.multi.opts[0]!.id, w.multi.opts[1]!.id] });
    }
    if (essay !== null) await m.put(v.id, w.essayQ!.id, { textAnswer: essay });
    await m.submit(v.id);
    return v.id;
  };
  const close = () => w.admin(`/sessions/${w.session.id}/close`);
  const finalize = () => w.admin(`/sessions/${w.session.id}/finalize`);
  const view = async () => (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}/grading`, headers: w.headers })).json<GradingView>();
  const answerOf = async (name: string) => (await view()).questions[0]!.answers.find(a => a.displayName === name)!;
  const grade = async (name: string, payload: unknown) => w.app.inject({ method: 'PUT', url: `/api/admin/answers/${(await answerOf(name)).answerId}/grade`, headers: w.headers, payload: payload as object });
  const board = async () => (await w.app.inject({ url: `/api/sessions/${w.session.id}/leaderboard` })).json<LeaderboardResponse>();
  return { ...w, members, submit, close, finalize, view, answerOf, grade, board };
}

describe('GET /api/admin/sessions/:id/grading', () => {
  it('needs the mentor cookie', async () => {
    const s = await setup();
    expect((await s.app.inject({ url: `/api/admin/sessions/${s.session.id}/grading` })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'PUT', url: '/api/admin/answers/1/grade', payload: { score: 1 } })).statusCode).toBe(401);
  });

  it('only after the session is closed; 404 for an unknown session', async () => {
    const s = await setup();
    const res = await s.app.inject({ url: `/api/admin/sessions/${s.session.id}/grading`, headers: s.headers }); // still running
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Chỉ chấm được sau khi đóng phiên' });
    expect((await s.app.inject({ url: '/api/admin/sessions/999/grading', headers: s.headers })).statusCode).toBe(404);
  });

  it('lists each essay question with its rubric and one answer per counted attempt', async () => {
    const s = await setup();
    await s.submit('An', 'merge giữ lịch sử');
    await s.submit('Bình', 'rebase viết lại');
    await s.close();
    const v = await s.view();
    expect(v).toMatchObject({ status: 'closed', graded: 0, total: 2 });
    expect(v.questions).toHaveLength(1);
    expect(v.questions[0]).toMatchObject({ id: s.essayQ!.id, prompt: 'Essay?', points: 4 });
    expect(v.questions[0]!.answers.map(a => [a.displayName, a.textAnswer, a.manualScore, a.feedback])).toEqual([
      ['An', 'merge giữ lịch sử', null, null],
      ['Bình', 'rebase viết lại', null, null],
    ]);
  });

  it('includes an attempt that closing the session submitted, and a blank essay as null text', async () => {
    const s = await setup();
    const m = s.members.get('An')!;
    const v = (await m.start()).json<AttemptView>();
    await m.put(v.id, s.essayQ!.id, { textAnswer: 'viết dở' }); // never submitted by hand
    await s.submit('Bình', null); // submitted without writing the essay
    await s.close();
    const answers = (await s.view()).questions[0]!.answers;
    expect(answers.map(a => [a.displayName, a.textAnswer])).toEqual([['An', 'viết dở'], ['Bình', null]]);
  });

  it('leaves out kicked members and members who never submitted', async () => {
    const s = await setup();
    await s.submit('An', 'a');
    await s.submit('Bình', 'b');
    // Chi never starts an attempt
    const detail = (await s.app.inject({ url: `/api/admin/sessions/${s.session.id}`, headers: s.headers })).json<SessionDetail>();
    await s.admin(`/participants/${detail.participants.find(p => p.displayName === 'Bình')!.id}/kick`);
    await s.close();
    expect((await s.view()).questions[0]!.answers.map(a => a.displayName)).toEqual(['An']);
  });

  it('is readable (read-only) after finalize', async () => {
    const s = await setup({ names: ['An'] });
    await s.submit('An', 'a');
    await s.close();
    await s.grade('An', { score: 3 });
    await s.finalize();
    expect(await s.view()).toMatchObject({ status: 'finalized', graded: 1, total: 1 });
  });
});

describe('PUT /api/admin/answers/:id/grade', () => {
  it('stores the score and feedback and reports progress', async () => {
    const s = await setup();
    await s.submit('An', 'a');
    await s.submit('Bình', 'b');
    await s.close();
    const res = await s.grade('An', { score: 3.5, feedback: '  Tốt, thiếu rủi ro rebase  ' });
    expect(res.statusCode).toBe(200);
    const body = res.json<GradeResponse>();
    expect(body).toMatchObject({ graded: 1, total: 2, answer: { displayName: 'An', manualScore: 3.5, feedback: 'Tốt, thiếu rủi ro rebase' } });
    expect((await s.answerOf('An')).manualScore).toBe(3.5);
    expect((await s.answerOf('Bình')).manualScore).toBeNull();
  });

  it("the member's own summary carries the essay total once graded (null before)", async () => {
    const s = await setup();
    await s.submit('An', 'a');
    await s.close();
    const mine = async () => (await s.members.get('An')!.me()).json<MeResponse>().attempt.submitted[0]!;
    expect(await mine()).toMatchObject({ score: 3, maxScore: 3, essayScore: null });
    await s.grade('An', { score: 2.5 });
    expect(await mine()).toMatchObject({ score: 3, essayScore: 2.5 });
  });

  it('accepts 0, the maximum and half points; rejects out-of-range, non-half and non-numeric scores with 400', async () => {
    const s = await setup({ names: ['An'] });
    await s.submit('An', 'a');
    await s.close();
    for (const score of [0, 4, 2.5, 0.5]) expect((await s.grade('An', { score })).statusCode, String(score)).toBe(200);
    const bad: [unknown, string][] = [
      [{ score: 4.5 }, 'Điểm phải từ 0 đến 4'],
      [{ score: 5 }, 'Điểm phải từ 0 đến 4'],
      [{ score: -1 }, 'Điểm không được âm'],
      [{ score: 0.3 }, 'Điểm phải là bội số của 0,5'],
      [{ score: '3' }, 'Điểm không hợp lệ'],
      [{}, 'Điểm không hợp lệ'],
      [{ score: 1, feedback: 'x'.repeat(2001) }, 'Nhận xét tối đa 2.000 ký tự'],
    ];
    for (const [payload, message] of bad) {
      const res = await s.grade('An', payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json()).toEqual({ error: message });
    }
    expect((await s.answerOf('An')).manualScore).toBe(0.5); // untouched by the failed attempts
  });

  it('a blank feedback is stored as none', async () => {
    const s = await setup({ names: ['An'] });
    await s.submit('An', 'a');
    await s.close();
    await s.grade('An', { score: 1, feedback: 'ok' });
    await s.grade('An', { score: 1, feedback: '   ' });
    expect((await s.answerOf('An')).feedback).toBeNull();
  });

  it('essay points the mentor has entered stay off the provisional leaderboard until finalize (PRODUCT §4.5), and regrading replaces rather than adds', async () => {
    const s = await setup({ names: ['An', 'Bình'] });
    await s.submit('An', 'a'); // 3 automatic points each
    await s.submit('Bình', 'b');
    await s.close();
    expect((await s.board()).entries.map(e => e.score)).toEqual([3, 3]);

    await s.grade('An', { score: 4 });
    await s.grade('Bình', { score: 1.5 });
    await s.grade('An', { score: 1 }); // regrade: the manual part is replaced, not added to
    const provisional = await s.board();
    expect(provisional.provisional).toBe(true);
    expect(provisional.entries.map(e => [e.displayName, e.score])).toEqual([['An', 3], ['Bình', 3]]); // still automatic part only

    await s.finalize();
    const official = await s.board();
    expect(official.provisional).toBe(false);
    expect(official.entries.map(e => [e.displayName, e.score])).toEqual([['Bình', 4.5], ['An', 4]]); // 3 + 1.5, 3 + 1
  });

  it('only while the session is closed: 409 while running, and 409 after finalize with the score unchanged', async () => {
    const s = await setup({ names: ['An'] });
    const attemptId = await s.submit('An', 'a');
    const essayRow = s.db.select().from(answers).all().find(a => a.attemptId === attemptId && a.questionId === s.essayQ!.id)!;
    const running = await s.app.inject({ method: 'PUT', url: `/api/admin/answers/${essayRow.id}/grade`, headers: s.headers, payload: { score: 1 } });
    expect(running.statusCode).toBe(409);
    expect(running.json()).toEqual({ error: 'Chỉ chấm được sau khi đóng phiên' });

    await s.close();
    await s.grade('An', { score: 2 });
    await s.finalize();
    const late = await s.grade('An', { score: 4 });
    expect(late.statusCode).toBe(409);
    expect(late.json()).toEqual({ error: 'Phiên đã chốt kết quả, không sửa điểm được' });
    expect((await s.answerOf('An')).manualScore).toBe(2);
  });

  it('404 for an unknown answer; a choice question cannot be graded by hand', async () => {
    const s = await setup({ names: ['An'] });
    const id = await s.submit('An', 'a');
    await s.close();
    for (const url of ['/api/admin/answers/99999/grade', '/api/admin/answers/abc/grade']) {
      expect((await s.app.inject({ method: 'PUT', url, headers: s.headers, payload: { score: 1 } })).statusCode, url).toBe(404);
    }
    const choiceRow = s.db.select().from(answers).all().find(a => a.attemptId === id && a.questionId === s.single.q.id)!;
    const res = await s.app.inject({ method: 'PUT', url: `/api/admin/answers/${choiceRow.id}/grade`, headers: s.headers, payload: { score: 1 } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Chỉ chấm tay được câu tự luận' });
  });

  it("a kicked member's answer cannot be graded", async () => {
    const s = await setup({ names: ['An', 'Bình'] });
    await s.submit('An', 'a');
    await s.submit('Bình', 'b');
    await s.close();
    const target = await s.answerOf('Bình');
    await s.admin(`/participants/${target.participantId}/kick`);
    const res = await s.app.inject({ method: 'PUT', url: `/api/admin/answers/${target.answerId}/grade`, headers: s.headers, payload: { score: 1 } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Người này đã bị mời ra khỏi phiên' });
  });

  it('publishes a leaderboard event; a rejected grade publishes nothing', async () => {
    const s = await setup({ names: ['An'] });
    await s.submit('An', 'a');
    await s.close();
    const seen: string[] = [];
    const off = bus.subscribe(s.session.id, t => seen.push(t));
    await s.grade('An', { score: 2 });
    expect(seen).toEqual(['leaderboard']);
    await s.grade('An', { score: 9 }); // 400
    expect(seen).toEqual(['leaderboard']);
    off();
  });
});

describe('finalize', () => {
  it('is blocked while counted essay answers are ungraded, naming how many are missing', async () => {
    const s = await setup();
    await s.submit('An', 'a');
    await s.submit('Bình', 'b');
    await s.submit('Chi', 'c');
    await s.close();
    await s.grade('An', { score: 3 });
    const res = await s.finalize();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Còn 2 bài tự luận chưa chấm điểm' });
    expect((await s.app.inject({ url: `/api/admin/sessions/${s.session.id}`, headers: s.headers })).json<SessionDetail>().status).toBe('closed');
  });

  it('a blank essay must be graded too (usually 0)', async () => {
    const s = await setup({ names: ['An', 'Bình'] });
    await s.submit('An', 'a');
    await s.submit('Bình', null); // left the essay empty
    await s.close();
    await s.grade('An', { score: 2 });
    expect((await s.finalize()).json()).toEqual({ error: 'Còn 1 bài tự luận chưa chấm điểm' });
    await s.grade('Bình', { score: 0 });
    expect((await s.finalize()).statusCode).toBe(200);
  });

  it('succeeds once everything is graded and turns the leaderboard official', async () => {
    const s = await setup({ names: ['An', 'Bình'] });
    await s.submit('An', 'a');
    await s.submit('Bình', 'b');
    await s.close();
    await s.grade('An', { score: 4 });
    await s.grade('Bình', { score: 1 });
    const res = await s.finalize();
    expect(res.statusCode).toBe(200);
    expect(res.json<SessionDetail>().status).toBe('finalized');
    const b = await s.board();
    expect(b.provisional).toBe(false);
    expect(b.entries.map(e => [e.displayName, e.score])).toEqual([['An', 7], ['Bình', 4]]);
  });

  it("a kicked member's ungraded essay does not block it, and nor does a member who never submitted", async () => {
    const s = await setup();
    await s.submit('An', 'a');
    await s.submit('Bình', 'b'); // will be kicked
    // Chi never submits
    const detail = (await s.app.inject({ url: `/api/admin/sessions/${s.session.id}`, headers: s.headers })).json<SessionDetail>();
    await s.admin(`/participants/${detail.participants.find(p => p.displayName === 'Bình')!.id}/kick`);
    await s.close();
    await s.grade('An', { score: 3 });
    expect((await s.finalize()).statusCode).toBe(200);
  });

  it('with nobody to grade, an essay exam can be finalized straight away', async () => {
    const s = await setup({ names: ['An'] });
    await s.close();
    expect((await s.finalize()).statusCode).toBe(200);
  });
});
