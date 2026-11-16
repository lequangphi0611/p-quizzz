import { describe, expect, it } from 'vitest';
import type { AttemptView, MeResponse } from '../../../shared/api/index.js';
import { allKeys, KEY_LEAKS, world } from '../world.js';

// A member who has already submitted an exam with one essay question (PRODUCT.md §7.21).
async function submitted() {
  const w = await world({ essay: true });
  const attempt = await w.startedAttempt(w.an);
  await w.an.put(attempt.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
  await w.an.put(attempt.id, w.essayQ!.id, { textAnswer: 'bản đầu' });
  expect((await w.an.submit(attempt.id)).statusCode).toBe(200);
  const participantId = (await w.detail()).participants.find(p => p.displayName === 'An')!.id;
  const request = (reason: unknown = 'Em quên một ý') => w.app.inject({ method: 'POST', url: `/api/me/attempts/${attempt.id}/edit-request`, headers: { 'x-participant-token': tokenOf(w) }, payload: { reason } as object });
  return { ...w, attempt, participantId, request, resolve: (decision: 'approve' | 'reject') => w.admin(`/participants/${participantId}/edit-request/${decision}`) };
}
// `world` hides the first member's token: read it back from the participants table.
import { participants } from '../../infrastructure/db/schema.js';
const tokenOf = (w: Awaited<ReturnType<typeof world>>) => w.db.select().from(participants).all().find(p => p.displayName === 'An')!.token;

describe('edit request — member side', () => {
  it('needs a submitted attempt', async () => {
    const w = await world({ essay: true });
    const a = await w.startedAttempt(w.an);
    const res = await w.app.inject({ method: 'POST', url: `/api/me/attempts/${a.id}/edit-request`, headers: { 'x-participant-token': tokenOf(w) }, payload: { reason: 'x' } });
    expect(res.statusCode).toBe(409);
  });

  it('requires a reason (400) and caps it at 500 characters', async () => {
    const s = await submitted();
    expect((await s.request('   ')).statusCode).toBe(400);
    expect((await s.request(null)).statusCode).toBe(400);
    expect((await s.request('x'.repeat(501))).statusCode).toBe(400);
  });

  it('records a pending request and shows it on /api/me', async () => {
    const s = await submitted();
    expect((await s.request()).statusCode).toBe(201);
    const me = (await s.an.me()).json<MeResponse>();
    expect(me.attempt.submitted[0]).toMatchObject({ canRequestEdit: false, editRequest: { status: 'pending', reason: 'Em quên một ý' } });
  });

  it('only one open request at a time', async () => {
    const s = await submitted();
    await s.request();
    const again = await s.request();
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toMatch(/chờ mentor/);
  });

  it('a rejected request can be sent again; the reason is replaced', async () => {
    const s = await submitted();
    await s.request('lần 1');
    expect((await s.resolve('reject')).statusCode).toBe(200);
    const me = (await s.an.me()).json<MeResponse>();
    expect(me.attempt.submitted[0]).toMatchObject({ canRequestEdit: true, editRequest: { status: 'rejected' } });
    expect((await s.request('lần 2')).statusCode).toBe(201);
    expect((await s.an.me()).json<MeResponse>().attempt.submitted[0]!.editRequest).toMatchObject({ status: 'pending', reason: 'lần 2' });
  });
});

describe('edit request — mentor side', () => {
  it('shows the request in the session detail so the bell can list it', async () => {
    const s = await submitted();
    await s.request();
    const an = (await s.detail()).participants.find(p => p.id === s.participantId)!;
    expect(an.progress.editRequest).toMatchObject({ status: 'pending', reason: 'Em quên một ý' });
  });

  it('needs the mentor session', async () => {
    const s = await submitted();
    await s.request();
    const res = await s.app.inject({ method: 'POST', url: `/api/admin/participants/${s.participantId}/edit-request/approve` });
    expect(res.statusCode).toBe(401);
  });

  it('can only settle a pending request (409 otherwise, 404 for an unknown person)', async () => {
    const s = await submitted();
    expect((await s.resolve('approve')).statusCode).toBe(409); // nothing asked yet
    await s.request();
    expect((await s.resolve('approve')).statusCode).toBe(200);
    expect((await s.resolve('reject')).statusCode).toBe(409); // already settled
    expect((await s.admin('/participants/9999/edit-request/approve')).statusCode).toBe(404);
  });

  it('cannot settle once the session is closed: the request has expired', async () => {
    const s = await submitted();
    await s.request();
    await s.admin(`/sessions/${s.session.id}/close`);
    expect((await s.resolve('approve')).statusCode).toBe(409);
    const an = (await s.detail()).participants.find(p => p.id === s.participantId)!;
    expect(an.progress.editRequest?.status).toBe('expired');
  });
});

describe('editing after approval', () => {
  it('stays locked before approval', async () => {
    const s = await submitted();
    const res = await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'lén sửa' });
    expect(res.statusCode).toBe(409);
    await s.request(); // pending is still locked
    expect((await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'lén sửa' })).statusCode).toBe(409);
  });

  it('lets the essay change but never a choice question, and keeps the automatic score', async () => {
    const s = await submitted();
    await s.request();
    await s.resolve('approve');
    expect((await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'bản sửa' })).statusCode).toBe(200);
    const locked = await s.an.put(s.attempt.id, s.single.q.id, { selectedOptionIds: [s.single.opts[1]!.id] });
    expect(locked.statusCode).toBe(409);
    expect(locked.json().error).toMatch(/tự luận/);

    const view = (await s.an.get(s.attempt.id)).json<AttemptView>();
    expect(view.editRequest?.status).toBe('approved');
    expect(view.answers.find(a => a.questionId === s.essayQ!.id)!.textAnswer).toBe('bản sửa');
    expect(view.answers.find(a => a.questionId === s.single.q.id)!.selectedOptionIds).toEqual([s.single.opts[0]!.id]);
    expect((await s.an.me()).json<MeResponse>().attempt.submitted[0]).toMatchObject({ score: 1 }); // unchanged
  });

  it('finishing closes the window for good: no more edits and no second request', async () => {
    const s = await submitted();
    await s.request();
    await s.resolve('approve');
    const fin = await s.app.inject({ method: 'POST', url: `/api/me/attempts/${s.attempt.id}/edit-request/finish`, headers: { 'x-participant-token': tokenOf(s) } });
    expect(fin.statusCode).toBe(200);
    expect((await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'muộn' })).statusCode).toBe(409);
    expect((await s.request()).statusCode).toBe(409);
    expect((await s.an.me()).json<MeResponse>().attempt.submitted[0]).toMatchObject({ canRequestEdit: false, editRequest: { status: 'done' } });
  });

  it('cannot finish a window that was never opened', async () => {
    const s = await submitted();
    const fin = await s.app.inject({ method: 'POST', url: `/api/me/attempts/${s.attempt.id}/edit-request/finish`, headers: { 'x-participant-token': tokenOf(s) } });
    expect(fin.statusCode).toBe(409);
  });

  it('closing the session ends editing but keeps what was saved', async () => {
    const s = await submitted();
    await s.request();
    await s.resolve('approve');
    await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'đã lưu' });
    await s.admin(`/sessions/${s.session.id}/close`);
    expect((await s.an.put(s.attempt.id, s.essayQ!.id, { textAnswer: 'sau khi đóng' })).statusCode).toBe(409);
    const view = (await s.an.get(s.attempt.id)).json<AttemptView>();
    expect(view.editRequest?.status).toBe('expired');
    expect(view.answers.find(a => a.questionId === s.essayQ!.id)!.textAnswer).toBe('đã lưu');
  });

  it("another member's attempt looks missing", async () => {
    const s = await submitted();
    const other = s.asMember(await s.join('Bình'));
    const res = await s.app.inject({ method: 'POST', url: `/api/me/attempts/${s.attempt.id}/edit-request`, headers: { 'x-participant-token': (await import('../../infrastructure/db/schema.js')).participants && s.db.select().from(participants).all().find(p => p.displayName === 'Bình')!.token }, payload: { reason: 'x' } });
    expect(res.statusCode).toBe(404);
    void other;
  });

  it('member responses still carry no answer key', async () => {
    const s = await submitted();
    await s.request();
    await s.resolve('approve');
    for (const body of [(await s.an.me()).json(), (await s.an.get(s.attempt.id)).json()]) {
      const keys = allKeys(body);
      for (const k of KEY_LEAKS) expect(keys.has(k)).toBe(false);
    }
  });
});
