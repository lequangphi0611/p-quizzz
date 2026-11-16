import { describe, expect, it } from 'vitest';
import { EmailTakenError, InvalidEmailError, KickedOutError, NameTakenError, NotInRosterError, ReplacedError, WrongRoomCodeError } from '../../../domain/participant/errors.js';
import { ALLOW_REJOIN_MS, NoHolderError, NotRejoinableError, RejoinNotPendingError, RejoinRequestNotFoundError, TooManyRequestsError } from '../../../domain/rejoin/rejoin.js';
import { FakeClock, FakeTokenGenerator, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryParticipantRepository } from '../../testing/in-memory-participant-repository.js';
import { InMemoryPresenceTracker } from '../../testing/in-memory-presence-tracker.js';
import { InMemoryRejoinRepository } from '../../testing/in-memory-rejoin-repository.js';
import { InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { JoinSession } from '../participants/join-session.js';
import { ResumeParticipant } from '../participants/resume-participant.js';
import { AllowRejoin, ApproveRejoinKeep, ApproveRejoinTakeover, CancelRejoin, GetRejoinStatus, RejectRejoin, RequestRejoin } from './rejoin-requests.js';

async function build(opts: { roster?: string[]; status?: 'lobby' | 'running' | 'closed' } = {}) {
  const exams = new InMemoryExamRepository();
  const sessions = new InMemorySessionRepository(exams);
  const people = new InMemoryParticipantRepository();
  const rejoin = new InMemoryRejoinRepository();
  const clock = new FakeClock(1_000_000);
  const events = new RecordingEventPublisher();
  const tokens = new FakeTokenGenerator();
  const presence = new InMemoryPresenceTracker(clock);
  const examId = await exams.add({ title: 'T', description: null, sourceMarkdown: '#', totalPoints: 1, hasEssay: false, createdAt: new Date(), questions: [] });
  const sessionId = await sessions.create({ examId, name: 'Phiên', access: opts.roster ? 'roster' : 'free', outsiderPolicy: 'block', sourceGroupId: null, mode: 'self_paced', shuffle: true, autoApprove: true, createdAt: new Date() });
  if (opts.roster) await sessions.addRoster(sessionId, opts.roster);
  await sessions.update(sessionId, { status: opts.status ?? 'running', roomCode: '123456' });
  const unitOfWork = new InMemoryUnitOfWork({ sessions, participants: people, rejoin }, [people, rejoin]);
  const deps = { unitOfWork, clock, events };
  return {
    sessionId, sessions, people, rejoin, clock, events, presence,
    join: new JoinSession({ unitOfWork, clock, tokens, events }),
    request: new RequestRejoin({ ...deps, tokens }),
    status: new GetRejoinStatus({ rejoin, participants: people, sessions }),
    cancel: new CancelRejoin({ ...deps, rejoin }),
    keep: new ApproveRejoinKeep(deps),
    takeover: new ApproveRejoinTakeover(deps),
    reject: new RejectRejoin(deps),
    allow: new AllowRejoin(deps),
    resume: new ResumeParticipant(people, presence),
  };
}
type W = Awaited<ReturnType<typeof build>>;

const LIST = ['phi78@gmail.com', 'phi89@gmail.com'];
const ask = (w: W, over: { displayName?: string; email?: string; roomCode?: string } = {}) =>
  w.request.execute({ sessionId: w.sessionId, roomCode: '123456', displayName: 'Phi 2', email: 'phi78@gmail.com', ...over });
async function holder(w: W, displayName = 'Phi', email: string | undefined = 'phi78@gmail.com') {
  return (await w.join.execute({ sessionId: w.sessionId, displayName, roomCode: '123456', email })).participant;
}

describe('asking to come back (roster session: the email decides)', () => {
  it('goes to the mentor as a pending request; the person holding the seat is untouched', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    w.events.events.length = 0;
    const r = await ask(w, { email: 'PHI78@gmail.com'.toLowerCase() });
    expect(r).toMatchObject({ status: 'pending', requestId: 1, token: expect.any(String) });
    expect(r.token).not.toBe(phi.token);
    expect((await w.people.findById(phi.id))!.token).toBe(phi.token);
    expect(w.events.events).toEqual([{ sessionId: w.sessionId, type: 'participants' }]);
    expect(await w.status.execute(r.token)).toEqual({ status: 'pending', sessionId: w.sessionId });
  });

  it('is never approved by itself, even when the person holding the seat has dropped off', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    w.clock.advance(60_000); // long silent
    expect(w.presence.connectionOf(phi.id).online).toBe(false);
    const r = await ask(w);
    expect(r.status).toBe('pending');
    expect((await w.people.findById(phi.id))!.token).toBe(phi.token); // still theirs
  });

  it('refuses a wrong room code, an email not on the list, a bad email, and a seat nobody holds', async () => {
    const w = await build({ roster: LIST });
    await holder(w);
    await expect(ask(w, { roomCode: '000000' })).rejects.toBeInstanceOf(WrongRoomCodeError);
    await expect(ask(w, { email: 'stranger@gmail.com' })).rejects.toBeInstanceOf(NotInRosterError);
    await expect(ask(w, { email: 'phi78@' })).rejects.toBeInstanceOf(InvalidEmailError);
    await expect(ask(w, { email: 'phi89@gmail.com' })).rejects.toBeInstanceOf(NoHolderError); // on the list, but nobody joined with it
  });

  it('limits how many people may queue for one seat', async () => {
    const w = await build({ roster: LIST });
    await holder(w);
    for (let i = 0; i < 5; i++) await ask(w);
    await expect(ask(w)).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it('a free session: the name decides, case-insensitively', async () => {
    const w = await build();
    await holder(w, 'Nguyễn Đạt', undefined);
    const r = await w.request.execute({ sessionId: w.sessionId, roomCode: '123456', displayName: 'NGUYỄN ĐẠT' });
    expect(r.status).toBe('pending');
    await expect(w.request.execute({ sessionId: w.sessionId, roomCode: '123456', displayName: 'Ai đó' })).rejects.toBeInstanceOf(NoHolderError);
  });

  it('the claimant can withdraw; withdrawing twice or after an answer changes nothing', async () => {
    const w = await build({ roster: LIST });
    await holder(w);
    const r = await ask(w);
    await w.cancel.execute(r.token);
    expect((await w.status.execute(r.token)).status).toBe('cancelled');
    await w.cancel.execute(r.token);
    await expect(w.cancel.execute('nope')).rejects.toBeInstanceOf(RejoinRequestNotFoundError);
    await expect(w.keep.execute(r.requestId!)).rejects.toBeInstanceOf(RejoinNotPendingError);
  });

  it('a request still waiting when the session closes reads as expired', async () => {
    const w = await build({ roster: LIST });
    await holder(w);
    const r = await ask(w);
    await w.sessions.update(w.sessionId, { status: 'closed' });
    expect((await w.status.execute(r.token)).status).toBe('expired');
  });
});

describe('the mentor answers', () => {
  it('"Cho vào lại, giữ bài": the new device takes the seat, keeps the name; the old device is told it was replaced; others are turned down', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    const real = await ask(w, { displayName: 'Phi (máy mới)' });
    const other = await ask(w, { displayName: 'Ai đó' });
    w.events.events.length = 0;
    await w.keep.execute(real.requestId!);

    const now = await w.resume.execute(real.token); // the claimant's token is now the participant's
    expect(now).toMatchObject({ id: phi.id, displayName: 'Phi', email: 'phi78@gmail.com', status: 'active' });
    await expect(w.resume.execute(phi.token)).rejects.toBeInstanceOf(ReplacedError);
    expect((await w.status.execute(real.token)).status).toBe('approved');
    expect((await w.status.execute(other.token)).status).toBe('rejected');
    expect(w.events.events.map(e => e.type)).toEqual(['participants']);
  });

  it('"Đây là mạo danh": the holder is kicked and loses the seat; the claimant comes in as a new person with their own name', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    const real = await ask(w, { displayName: 'Phi thật' });
    w.events.events.length = 0;
    await w.takeover.execute(real.requestId!);

    await expect(w.resume.execute(phi.token)).rejects.toBeInstanceOf(KickedOutError);
    const me = await w.resume.execute(real.token);
    expect(me).toMatchObject({ displayName: 'Phi thật', email: 'phi78@gmail.com', status: 'active' });
    expect(me.id).not.toBe(phi.id);
    expect((await w.people.listNotKicked(w.sessionId)).map(p => p.displayName)).toEqual(['Phi thật']);
    expect(w.events.events.map(e => e.type)).toEqual(['participants', 'leaderboard']);
  });

  it('a takeover whose name is taken by somebody else is refused and changes nothing', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    await holder(w, 'Bình', 'phi89@gmail.com');
    const r = await ask(w, { displayName: 'bình' });
    await expect(w.takeover.execute(r.requestId!)).rejects.toBeInstanceOf(NameTakenError);
    expect((await w.people.findById(phi.id))!.status).toBe('active'); // rolled back: the holder was not kicked
    expect((await w.status.execute(r.token)).status).toBe('pending');
  });

  it('"Từ chối" closes the request; it cannot be answered twice; a closed session cannot be answered', async () => {
    const w = await build({ roster: LIST });
    await holder(w);
    const a = await ask(w);
    await w.reject.execute(a.requestId!);
    expect((await w.status.execute(a.token)).status).toBe('rejected');
    await expect(w.reject.execute(a.requestId!)).rejects.toBeInstanceOf(RejoinNotPendingError);
    const b = await ask(w);
    await w.sessions.update(w.sessionId, { status: 'closed' });
    await expect(w.keep.execute(b.requestId!)).rejects.toBeInstanceOf(NotRejoinableError);
    await expect(w.keep.execute(99)).rejects.toBeInstanceOf(RejoinRequestNotFoundError);
  });
});

describe('"let them back in" in advance (a short, one-time permission)', () => {
  it('entering the same email again takes the seat over at once, keeping the name; works once', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    await w.allow.execute(phi.id);
    const back = await w.join.execute({ sessionId: w.sessionId, displayName: 'Bất kỳ', roomCode: '123456', email: 'phi78@gmail.com' });
    expect(back.participant).toMatchObject({ id: phi.id, displayName: 'Phi' });
    await expect(w.resume.execute(phi.token)).rejects.toBeInstanceOf(ReplacedError);
    expect((await w.resume.execute(back.token)).id).toBe(phi.id);
    // spent: the next try is an ordinary clash
    await expect(w.join.execute({ sessionId: w.sessionId, displayName: 'X', roomCode: '123456', email: 'phi78@gmail.com' })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('asking to come back with the permission is approved at once, without a request for the mentor', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    await w.allow.execute(phi.id);
    const r = await ask(w);
    expect(r).toMatchObject({ status: 'approved', requestId: null });
    expect((await w.resume.execute(r.token)).id).toBe(phi.id);
  });

  it('lapses after ten minutes', async () => {
    const w = await build({ roster: LIST });
    const phi = await holder(w);
    await w.allow.execute(phi.id);
    w.clock.advance(ALLOW_REJOIN_MS + 1);
    await expect(w.join.execute({ sessionId: w.sessionId, displayName: 'X', roomCode: '123456', email: 'phi78@gmail.com' })).rejects.toBeInstanceOf(EmailTakenError);
    expect((await ask(w)).status).toBe('pending');
  });

  it('a free session works the same way with the name; only open sessions and people not kicked', async () => {
    const w = await build();
    const an = await holder(w, 'An', undefined);
    await w.allow.execute(an.id);
    expect((await w.join.execute({ sessionId: w.sessionId, displayName: 'an', roomCode: '123456' })).participant.id).toBe(an.id);
    await w.people.update(an.id, { status: 'kicked' });
    await expect(w.allow.execute(an.id)).rejects.toBeInstanceOf(NotRejoinableError);
    const w2 = await build({ status: 'closed' });
    const p = await w2.people.add({ sessionId: w2.sessionId, displayName: 'X', email: null, token: 't', status: 'active', joinedAt: new Date() });
    await expect(w2.allow.execute(p.id)).rejects.toBeInstanceOf(NotRejoinableError);
  });
});

describe('presence', () => {
  it('every request the member\'s browser makes is a sign of life; silence for 15 seconds is offline', async () => {
    const w = await build();
    const an = await holder(w, 'An', undefined);
    expect(w.presence.connectionOf(an.id)).toEqual({ online: false, lastSeenAt: null });
    await w.resume.execute(an.token);
    expect(w.presence.connectionOf(an.id)).toMatchObject({ online: true, lastSeenAt: 1_000_000 });
    w.clock.advance(14_000);
    expect(w.presence.connectionOf(an.id).online).toBe(true);
    w.clock.advance(2_000);
    expect(w.presence.connectionOf(an.id)).toMatchObject({ online: false, lastSeenAt: 1_000_000 });
  });
});
