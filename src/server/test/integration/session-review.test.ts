import { describe, expect, it } from 'vitest';
import type { AttemptView, ParticipantReview, SessionDetail } from '../../../shared/api/index.js';
import { world } from '../world.js';

// Three members: An and Bảo (submit), Chi (never starts). Essay exam so manual grading matters.
async function setup(opts: { essay?: boolean } = {}) {
  const w = await world({ essay: opts.essay ?? true, shuffle: false, state: 'lobby' });
  const bao = w.asMember(await w.join('Bảo'));
  await w.join('Chi');
  await w.admin(`/sessions/${w.session.id}/start`);
  const detail = async () => (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}`, headers: w.headers })).json<SessionDetail>();
  const idOf = async (name: string) => (await detail()).participants.find(p => p.displayName === name)!.id;
  const review = async (name: string, extra: { headers?: Record<string, string>; remoteAddress?: string } = {}) =>
    w.app.inject({ url: `/api/admin/participants/${await idOf(name)}/review`, headers: extra.headers ?? w.headers, remoteAddress: extra.remoteAddress });
  return { ...w, bao, detail, idOf, review };
}

describe('GET /api/admin/participants/:id/review', () => {
  it('needs the mentor cookie and the mentor machine', async () => {
    const s = await setup();
    expect((await s.review('An', { headers: {} })).statusCode).toBe(401);
    expect((await s.review('An', { remoteAddress: '192.168.1.50' })).statusCode).toBe(403);
  });

  it('404 for an unknown or malformed participant', async () => {
    const s = await setup();
    for (const id of ['99999', 'abc']) expect((await s.app.inject({ url: `/api/admin/participants/${id}/review`, headers: s.headers })).statusCode, id).toBe(404);
  });

  it('shows what someone chose, the key, the explanation and the score — in the order they saw it', async () => {
    const s = await setup();
    const v = (await s.an.start()).json<AttemptView>();
    await s.an.put(v.id, s.single.q.id, { selectedOptionIds: [s.single.opts[1]!.id] }); // wrong
    await s.an.put(v.id, s.multi.q.id, { selectedOptionIds: [s.multi.opts[0]!.id, s.multi.opts[1]!.id] }); // right
    await s.an.put(v.id, s.essayQ!.id, { textAnswer: 'bài tự luận của An' });
    await s.an.submit(v.id);

    const res = await s.review('An');
    expect(res.statusCode).toBe(200);
    const r = res.json<ParticipantReview>();
    expect(r).toMatchObject({ participant: { displayName: 'An', status: 'active' }, state: 'submitted' });
    expect(r.attempt!.questions.map(q => q.id)).toEqual(v.questions.map(q => q.id));
    const single = r.attempt!.questions.find(q => q.id === s.single.q.id)!;
    expect(single.options.map(o => [o.text, o.isCorrect])).toEqual([['A', true], ['B', false]]);
    expect(single).toMatchObject({ selectedOptionIds: [s.single.opts[1]!.id], score: 0 });
    expect(r.attempt!.questions.find(q => q.id === s.multi.q.id)).toMatchObject({ score: 2 });
    expect(r.attempt!.questions.find(q => q.type === 'essay')).toMatchObject({ textAnswer: 'bài tự luận của An', score: null });
    expect(r.attempt).toMatchObject({ score: 2, maxScore: 7, official: false });
  });

  it('works while the session is still running (the mentor may look at any time), unlike the member review', async () => {
    const s = await setup();
    const v = (await s.an.start()).json<AttemptView>();
    await s.an.submit(v.id);
    expect((await s.review('An')).statusCode).toBe(200);
  });

  it('shows graded essays with the mentor\'s score and feedback, and "official" after the finalize', async () => {
    const s = await setup({ essay: true });
    const a = (await s.an.start()).json<AttemptView>();
    await s.an.put(a.id, s.essayQ!.id, { textAnswer: 'x' });
    await s.an.submit(a.id);
    await s.admin(`/sessions/${s.session.id}/close`);
    const grading = (await s.app.inject({ url: `/api/admin/sessions/${s.session.id}/grading`, headers: s.headers })).json<{ questions: { answers: { answerId: number; displayName: string }[] }[] }>();
    await s.app.inject({ method: 'PUT', url: `/api/admin/answers/${grading.questions[0]!.answers[0]!.answerId}/grade`, headers: s.headers, payload: { score: 3.5, feedback: 'Khá' } });
    expect((await s.admin(`/sessions/${s.session.id}/finalize`)).statusCode).toBe(200);
    const r = (await s.review('An')).json<ParticipantReview>();
    expect(r.attempt!.questions.find(q => q.type === 'essay')).toMatchObject({ score: 3.5, feedback: 'Khá' });
    expect(r.attempt).toMatchObject({ official: true, score: 3.5 });
  });

  it('a person who never started has nothing to show; one still writing shows "doing" without a review yet', async () => {
    const s = await setup();
    expect((await s.review('Chi')).json<ParticipantReview>()).toMatchObject({ state: 'none', attempt: null });
    await s.bao.start();
    expect((await s.review('Bảo')).json<ParticipantReview>()).toMatchObject({ state: 'doing', attempt: null });
  });

  it('a kicked member can still be reviewed and is marked as kicked', async () => {
    const s = await setup();
    const v = (await s.bao.start()).json<AttemptView>();
    await s.bao.submit(v.id);
    await s.admin(`/participants/${await s.idOf('Bảo')}/kick`);
    const r = (await s.review('Bảo')).json<ParticipantReview>();
    expect(r.participant.status).toBe('kicked');
    expect(r.state).toBe('submitted');
    expect(r.attempt).not.toBeNull();
  });

  it('closing the session submits unfinished work, and the review shows what was saved', async () => {
    const s = await setup();
    const v = (await s.an.start()).json<AttemptView>();
    await s.an.put(v.id, s.single.q.id, { selectedOptionIds: [s.single.opts[0]!.id] });
    await s.admin(`/sessions/${s.session.id}/close`);
    const r = (await s.review('An')).json<ParticipantReview>();
    expect(r.state).toBe('submitted');
    expect(r.attempt!.questions.find(q => q.id === s.single.q.id)).toMatchObject({ selectedOptionIds: [s.single.opts[0]!.id], score: 1 });
  });

  it('a kicked member who never submitted is not "doing" once the session is closed', async () => {
    const s = await setup();
    await s.bao.start();
    await s.admin(`/participants/${await s.idOf('Bảo')}/kick`);
    await s.admin(`/sessions/${s.session.id}/close`);
    expect((await s.review('Bảo')).json<ParticipantReview>().state).toBe('none');
    const row = (await s.detail()).participants.find(p => p.displayName === 'Bảo')!;
    expect(row.progress.state).toBe('none');
  });

  it('kick, rename and approve are refused once the session is finalized', async () => {
    const s = await setup({ essay: false });
    await s.admin(`/sessions/${s.session.id}/close`);
    await s.admin(`/sessions/${s.session.id}/finalize`);
    const id = await s.idOf('An');
    expect((await s.admin(`/participants/${id}/kick`)).statusCode).toBe(409);
    expect((await s.app.inject({ method: 'PATCH', url: `/api/admin/participants/${id}`, headers: s.headers, payload: { displayName: 'Mới' } })).statusCode).toBe(409);
    expect((await s.admin(`/participants/${id}/approve`)).statusCode).toBe(409);
  });
});
