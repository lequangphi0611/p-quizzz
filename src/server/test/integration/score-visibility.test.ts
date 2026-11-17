import { describe, expect, it } from 'vitest';
import type { AttemptView, LeaderboardResponse, MeResponse, SessionDetail, SubmitResponse } from '../../../shared/api/index.js';
import { world } from '../world.js';

// PRODUCT.md §7.25: the mentor may hold scores and the leaderboard back until they publish them (or close the session).
async function held(opts: { essay?: boolean } = {}) {
  const w = await world({ essay: opts.essay ?? false, scoreVisibility: 'on_release', shuffle: false });
  const board = async () => (await w.app.inject({ url: `/api/sessions/${w.session.id}/leaderboard` })).json<LeaderboardResponse>();
  const put = (payload: object) => w.app.inject({ method: 'PUT', url: `/api/admin/sessions/${w.session.id}/score-visibility`, headers: w.headers, payload });
  const release = () => w.admin(`/sessions/${w.session.id}/release-scores`);
  const play = async (m: ReturnType<typeof w.asMember>) => {
    const v = (await m.start()).json<AttemptView>();
    await m.put(v.id, w.single.q.id, { selectedOptionIds: [w.single.opts[0]!.id] });
    return (await m.submit(v.id)).json<SubmitResponse>();
  };
  return { ...w, board, put, release, play };
}

describe('score visibility (PRODUCT.md §7.25)', () => {
  it('defaults to showing scores on submit', async () => {
    const w = await world();
    const d = await w.detail();
    expect([d.scoreVisibility, d.scoresHidden, d.scoresReleasedAt]).toEqual(['on_submit', false, null]);
  });

  it('while held: submit response, /api/me and the leaderboard carry no score or rank; the mentor still sees them', async () => {
    const w = await held();
    expect((await w.detail()).scoresHidden).toBe(true);
    const submitted = await w.play(w.an);
    expect(submitted.attempt.score).toBeNull();
    expect(submitted.attempt.essayScore).toBeNull();
    expect(submitted.attempt.submittedAt).toEqual(expect.any(Number));

    const me = (await w.an.me()).json<MeResponse>();
    expect(me.session.scoresHidden).toBe(true);
    expect(me.attempt.submitted[0]!.score).toBeNull();

    const b = await w.board();
    expect(b.hidden).toBe(true);
    expect(b.entries).toEqual([]);
    expect(b.submitted).toEqual([{ displayName: 'An', submittedAt: submitted.attempt.submittedAt }]);
    expect(JSON.stringify(b)).not.toMatch(/score|rank/i);

    const an = (await w.detail()).participants.find(p => p.displayName === 'An')!;
    expect(an.progress.countedScore).toBe(1); // the mentor is never kept from the scores
    expect(an.progress.submittedAt).toEqual(submitted.attempt.submittedAt);
  });

  it('"Công bố điểm" shows scores to everyone and cannot be undone', async () => {
    const w = await held();
    await w.play(w.an);
    const res = await w.release();
    expect(res.statusCode).toBe(200);
    const d = res.json<SessionDetail>();
    expect([d.scoresHidden, typeof d.scoresReleasedAt]).toEqual([false, 'number']);
    expect((await w.board()).entries.map(e => [e.displayName, e.score])).toEqual([['An', 1]]);
    expect((await w.an.me()).json<MeResponse>().attempt.submitted[0]!.score).toBe(1);
    expect((await w.release()).statusCode).toBe(409); // nothing left to publish
    expect((await w.put({ scoreVisibility: 'on_release' })).statusCode).toBe(409); // published scores never hide again
  });

  it('closing the session publishes held scores', async () => {
    const w = await held();
    await w.play(w.an);
    await w.admin(`/sessions/${w.session.id}/close`);
    expect((await w.board()).hidden).toBe(false);
    expect((await w.board()).entries).toHaveLength(1);
    expect((await w.detail()).scoresHidden).toBe(false);
    expect((await w.release()).statusCode).toBe(409);
  });

  it('the setting changes only while nobody has submitted', async () => {
    const w = await held();
    const toShow = await w.put({ scoreVisibility: 'on_submit' });
    expect(toShow.statusCode).toBe(200);
    expect(toShow.json<SessionDetail>().scoresHidden).toBe(false);
    expect((await w.put({ scoreVisibility: 'on_release' })).statusCode).toBe(200);
    await w.play(w.an);
    const locked = await w.put({ scoreVisibility: 'on_submit' });
    expect(locked.statusCode).toBe(409);
    expect(locked.json<{ error: string }>().error).toMatch(/nộp/);
    expect((await w.put({ scoreVisibility: 'nope' })).statusCode).toBe(400);
  });

  it('a kicked member who submitted still locks the setting (they may have seen a score)', async () => {
    const w = await world({ shuffle: false });
    const v = (await w.an.start()).json<AttemptView>();
    await w.an.submit(v.id);
    const an = (await w.detail()).participants.find(p => p.displayName === 'An')!;
    await w.admin(`/participants/${an.id}/kick`);
    const res = await w.app.inject({ method: 'PUT', url: `/api/admin/sessions/${w.session.id}/score-visibility`, headers: w.headers, payload: { scoreVisibility: 'on_release' } });
    expect(res.statusCode).toBe(409);
  });

  it('releasing a session that shows scores on submit → 409; unknown session → 404; mentor only', async () => {
    const w = await world();
    expect((await w.admin(`/sessions/${w.session.id}/release-scores`)).statusCode).toBe(409);
    expect((await w.admin('/sessions/999/release-scores')).statusCode).toBe(404);
    expect((await w.app.inject({ method: 'POST', url: `/api/admin/sessions/${w.session.id}/release-scores` })).statusCode).toBe(401);
  });
});
