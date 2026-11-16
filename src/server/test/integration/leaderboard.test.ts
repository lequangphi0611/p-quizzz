import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { AttemptView, LeaderboardResponse } from '../../../shared/api/index.js';
import { attempts } from '../../infrastructure/db/schema.js';
import { world } from '../world.js';

// Lobby → several members join → start. Returns helpers to make each member score a given amount.
async function room(opts: { essay?: boolean; names: string[] }) {
  const w = await world({ essay: opts.essay ?? false, state: 'lobby', shuffle: false });
  const members = new Map<string, ReturnType<typeof w.asMember>>();
  for (const n of opts.names) members.set(n, n === 'An' ? w.an : w.asMember(await w.join(n))); // world() already joined "An"
  await w.admin(`/sessions/${w.session.id}/start`);
  const board = async () => (await w.app.inject({ url: `/api/sessions/${w.session.id}/leaderboard` })).json<LeaderboardResponse>();

  // Plays one attempt and submits it. `points`: 0, 1 (single right) or 3 (single + multi right).
  const play = async (name: string, points: 0 | 1 | 3) => {
    const m = members.get(name)!;
    const v = (await m.start()).json<AttemptView>();
    if (points >= 1) await m.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
    if (points >= 3) await m.put(v.id, w.multi.q.id, { selectedOptionIds: [w.multi.opts[0]!.id, w.multi.opts[1]!.id] });
    await m.submit(v.id);
    return v.id;
  };
  return { ...w, members, board, play };
}

describe('GET /api/sessions/:id/leaderboard', () => {
  it('is public, empty before anyone submits; 404 for an unknown or malformed session', async () => {
    const r = await room({ names: ['An'] });
    const res = await r.app.inject({ url: `/api/sessions/${r.session.id}/leaderboard` }); // no cookie, no token
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ provisional: true, entries: [] });
    expect((await r.app.inject({ url: '/api/sessions/999/leaderboard' })).statusCode).toBe(404);
    expect((await r.app.inject({ url: '/api/sessions/abc/leaderboard' })).statusCode).toBe(404);
  });

  it('orders by score; equal score → earlier submission first; includes maxScore', async () => {
    const r = await room({ names: ['An', 'Bình', 'Chi', 'Dũng'] });
    await r.play('Bình', 1);
    await r.play('An', 3);
    await r.play('Chi', 1); // same score as Bình, submitted later
    const b = await r.board();
    expect(b.entries.map(e => [e.rank, e.displayName, e.score, e.maxScore])).toEqual([[1, 'An', 3, 3], [2, 'Bình', 1, 3], [3, 'Chi', 1, 3]]);
    expect(b.entries[1]!.submittedAt).toBeLessThan(b.entries[2]!.submittedAt);
  });

  it('members who have not submitted do not appear (an attempt in progress is not enough)', async () => {
    const r = await room({ names: ['An', 'Bình'] });
    await r.play('An', 3);
    await r.members.get('Bình')!.start(); // started, not submitted
    expect((await r.board()).entries.map(e => e.displayName)).toEqual(['An']);
  });

  it('a kicked member disappears, even with a submitted attempt; a pending member never appears', async () => {
    const r = await room({ names: ['An', 'Bình'] });
    await r.play('An', 3);
    await r.play('Bình', 1);
    const detail = (await r.app.inject({ url: `/api/admin/sessions/${r.session.id}`, headers: r.headers })).json<{ participants: { id: number; displayName: string }[] }>();
    await r.admin(`/participants/${detail.participants.find(p => p.displayName === 'An')!.id}/kick`);
    const late = r.asMember(await r.join('Trễ')); // joins after start → pending
    expect((await late.start()).statusCode).toBe(409);
    expect((await r.board()).entries.map(e => e.displayName)).toEqual(['Bình']);
  });

  it('one attempt each: a second start is refused and the ranking keeps the first score', async () => {
    const r = await room({ names: ['An'] });
    await r.play('An', 1);
    expect((await r.members.get('An')!.start()).statusCode).toBe(409); // no retake inside a session
    const b = await r.board();
    expect(b.entries.map(e => [e.displayName, e.score])).toEqual([['An', 1]]);
  });

  it('players who tie on score and on the exact submission instant share a rank (1, 1, 3)', async () => {
    const r = await room({ names: ['An', 'Bình', 'Chi'] });
    const a = await r.play('An', 3);
    const b = await r.play('Bình', 3);
    await r.play('Chi', 1);
    const at = new Date(1_700_000_000_000);
    for (const id of [a, b]) r.db.update(attempts).set({ submittedAt: at }).where(eq(attempts.id, id)).run();
    expect((await r.board()).entries.map(e => [e.rank, e.displayName])).toEqual([[1, 'An'], [1, 'Bình'], [3, 'Chi']]);
  });

  it('exam with essays: graded points stay hidden while provisional and count only on finalize (PRODUCT §4.5)', async () => {
    const r = await room({ essay: true, names: ['An', 'Bình'] });
    await r.play('An', 3);
    await r.play('Bình', 3);
    let b = await r.board();
    expect(b.provisional).toBe(true);
    expect(b.entries.map(e => e.score)).toEqual([3, 3]);
    expect(b.entries[0]!.maxScore).toBe(7);

    await r.admin(`/sessions/${r.session.id}/close`);
    expect((await r.board()).provisional).toBe(true); // closed: essays still to grade

    const view = (await r.app.inject({ url: `/api/admin/sessions/${r.session.id}/grading`, headers: r.headers })).json<{ questions: { answers: { answerId: number; displayName: string }[] }[] }>();
    const grade = (name: string, score: number) =>
      r.app.inject({ method: 'PUT', url: `/api/admin/answers/${view.questions[0]!.answers.find(a => a.displayName === name)!.answerId}/grade`, headers: r.headers, payload: { score } });
    await grade('An', 4);
    await grade('Bình', 0);
    b = await r.board();
    expect(b.entries.map(e => [e.displayName, e.score])).toEqual([['An', 3], ['Bình', 3]]); // graded, but not official yet

    await r.admin(`/sessions/${r.session.id}/finalize`);
    b = await r.board();
    expect(b.provisional).toBe(false);
    expect(b.entries.map(e => [e.displayName, e.score])).toEqual([['An', 7], ['Bình', 3]]);
  });

  it('shows only rank, name, score, maxScore and submittedAt — nothing that identifies or authenticates', async () => {
    const r = await room({ names: ['An'] });
    await r.play('An', 3);
    const res = await r.app.inject({ url: `/api/sessions/${r.session.id}/leaderboard` });
    const b = res.json<LeaderboardResponse>();
    expect(Object.keys(b.entries[0]!).sort()).toEqual(['displayName', 'maxScore', 'rank', 'score', 'submittedAt']);
    expect(Object.keys(b).sort()).toEqual(['entries', 'provisional']);
  });
});
