import { describe, expect, it } from 'vitest';
import {
  KickedOutError, NameTakenError, NotJoinedError, NotPendingError, ParticipantKickedError, ParticipantNotFoundError,
  SessionClosedForApprovalError, SessionFinalizedError, SessionNotOpenError, WrongRoomCodeError,
} from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { FakeClock, FakeTokenGenerator, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryParticipantRepository } from '../../testing/in-memory-participant-repository.js';
import { InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { ApproveParticipant } from './approve-participant.js';
import { JoinSession } from './join-session.js';
import { KickParticipant } from './kick-participant.js';
import { ListPublicParticipants } from './list-public-participants.js';
import { RenameParticipant } from './rename-participant.js';
import { ResumeParticipant } from './resume-participant.js';

let sessions: InMemorySessionRepository;
let people: InMemoryParticipantRepository;
let events: RecordingEventPublisher;

async function build(opts: { autoApprove?: boolean; status?: 'lobby' | 'running' | 'closed' | 'finalized' | 'draft' } = {}) {
  const exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  people = new InMemoryParticipantRepository();
  events = new RecordingEventPublisher();
  const examId = await exams.add({ title: 'T', description: null, sourceMarkdown: '#', totalPoints: 1, hasEssay: false, createdAt: new Date(), questions: [] });
  const sessionId = await sessions.create({ examId, name: 'Phiên', mode: 'self_paced', shuffle: true, autoApprove: opts.autoApprove ?? false, createdAt: new Date() });
  await sessions.update(sessionId, { status: opts.status ?? 'lobby', roomCode: '123456' });
  const unitOfWork = new InMemoryUnitOfWork({ sessions, participants: people }, [people]);
  const deps = { unitOfWork, clock: new FakeClock(500), tokens: new FakeTokenGenerator(), events };
  return {
    sessionId,
    join: new JoinSession(deps),
    rename: new RenameParticipant(deps),
    kick: new KickParticipant(deps),
    approve: new ApproveParticipant(deps),
    resume: new ResumeParticipant(people),
    listPublic: new ListPublicParticipants({ sessions, participants: people }),
  };
}


describe('JoinSession', () => {
  it('joins as pending by default and as active when the session auto-approves; publishes participants', async () => {
    const a = await build();
    const { token, participant } = await a.join.execute({ sessionId: a.sessionId, displayName: 'Lan', roomCode: '123456' });
    expect(token).toBe('token-1');
    expect(participant).toMatchObject({ displayName: 'Lan', status: 'pending', token: 'token-1', joinedAt: new Date(500) });
    expect(events.events).toEqual([{ sessionId: a.sessionId, type: 'participants' }]);

    const b = await build({ autoApprove: true });
    expect((await b.join.execute({ sessionId: b.sessionId, displayName: 'Lan', roomCode: '123456' })).participant.status).toBe('active');
  });

  it('rejects an unknown session, a closed one, a wrong code (403) and a name already taken (any letter case)', async () => {
    const a = await build();
    await expect(a.join.execute({ sessionId: 99, displayName: 'x', roomCode: '123456' })).rejects.toBeInstanceOf(SessionNotFoundError);
    await expect(a.join.execute({ sessionId: a.sessionId, displayName: 'x', roomCode: '000000' })).rejects.toBeInstanceOf(WrongRoomCodeError);
    await a.join.execute({ sessionId: a.sessionId, displayName: 'Đạt', roomCode: '123456' });
    await expect(a.join.execute({ sessionId: a.sessionId, displayName: 'đạt', roomCode: '123456' })).rejects.toBeInstanceOf(NameTakenError);
    expect(events.events).toHaveLength(1); // failures publish nothing

    const closed = await build({ status: 'closed' });
    await expect(closed.join.execute({ sessionId: closed.sessionId, displayName: 'x', roomCode: '123456' })).rejects.toBeInstanceOf(SessionNotOpenError);
  });

  it('checks the room state before the code, so a closed session never reveals whether the code was right', async () => {
    const closed = await build({ status: 'draft' });
    await expect(closed.join.execute({ sessionId: closed.sessionId, displayName: 'x', roomCode: '999999' })).rejects.toBeInstanceOf(SessionNotOpenError);
  });
});

describe('Rename / Kick / Approve', () => {
  async function joined(opts?: Parameters<typeof build>[0]) {
    const c = await build(opts);
    const { participant } = await c.join.execute({ sessionId: c.sessionId, displayName: 'Lan', roomCode: '123456' });
    events.events.length = 0;
    return { c, id: participant.id };
  }

  it('renames, keeps names unique, and publishes participants + leaderboard', async () => {
    const { c, id } = await joined();
    await c.join.execute({ sessionId: c.sessionId, displayName: 'Mai', roomCode: '123456' });
    events.events.length = 0;
    expect((await c.rename.execute(id, 'Lan Anh')).displayName).toBe('Lan Anh');
    expect(events.events.map(e => e.type)).toEqual(['participants', 'leaderboard']);
    await expect(c.rename.execute(id, 'mai')).rejects.toBeInstanceOf(NameTakenError);
    await expect(c.rename.execute(id, 'LAN ANH')).resolves.toBeTruthy(); // its own name, other letter case
    await expect(c.rename.execute(99, 'x')).rejects.toBeInstanceOf(ParticipantNotFoundError);
  });

  it('kick frees the name and cannot be repeated; kicked members cannot be renamed', async () => {
    const { c, id } = await joined();
    expect((await c.kick.execute(id)).status).toBe('kicked');
    expect(events.events.map(e => e.type)).toEqual(['participants', 'leaderboard']);
    await expect(c.kick.execute(id)).rejects.toBeInstanceOf(ParticipantKickedError);
    await expect(c.rename.execute(id, 'Khác')).rejects.toBeInstanceOf(ParticipantKickedError);
    await expect(c.join.execute({ sessionId: c.sessionId, displayName: 'Lan', roomCode: '123456' })).resolves.toBeTruthy();
  });

  it('a finalized session freezes the list', async () => {
    const { c, id } = await joined();
    await sessions.update(c.sessionId, { status: 'finalized' });
    await expect(c.rename.execute(id, 'x')).rejects.toBeInstanceOf(SessionFinalizedError);
    await expect(c.kick.execute(id)).rejects.toBeInstanceOf(SessionFinalizedError);
  });

  it('approve activates a pending member only, and only while the session is active', async () => {
    const { c, id } = await joined();
    expect((await c.approve.execute(id)).status).toBe('active');
    expect(events.events.map(e => e.type)).toEqual(['participants']);
    await expect(c.approve.execute(id)).rejects.toBeInstanceOf(NotPendingError);

    const { c: c2, id: id2 } = await joined();
    await sessions.update(c2.sessionId, { status: 'closed' });
    await expect(c2.approve.execute(id2)).rejects.toBeInstanceOf(SessionClosedForApprovalError);
    await expect(c2.approve.execute(99)).rejects.toBeInstanceOf(ParticipantNotFoundError);
  });
});

describe('ResumeParticipant / ListPublicParticipants', () => {
  it('resolves a token; unknown or missing is NotJoined (401); kicked is KickedOut (403)', async () => {
    const c = await build({ autoApprove: true });
    const { token, participant } = await c.join.execute({ sessionId: c.sessionId, displayName: 'Lan', roomCode: '123456' });
    expect((await c.resume.execute(token)).id).toBe(participant.id);
    for (const bad of [undefined, '', 'nope']) {
      const err = await c.resume.execute(bad).catch(e => e);
      expect(err).toBeInstanceOf(NotJoinedError);
      expect(err.kind).toBe('unauthenticated');
    }
    await c.kick.execute(participant.id);
    const err = await c.resume.execute(token).catch(e => e);
    expect(err).toBeInstanceOf(KickedOutError);
    expect(err.kind).toBe('forbidden');
  });

  it('lists only active names in join order, and 404s for an unknown session', async () => {
    const c = await build();
    const a = await c.join.execute({ sessionId: c.sessionId, displayName: 'An', roomCode: '123456' });
    await c.join.execute({ sessionId: c.sessionId, displayName: 'Bình', roomCode: '123456' });
    expect(await c.listPublic.execute(c.sessionId)).toEqual([]); // pending members are not shown
    await c.approve.execute(a.participant.id);
    expect(await c.listPublic.execute(c.sessionId)).toEqual([{ displayName: 'An' }]);
    await expect(c.listPublic.execute(99)).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});
