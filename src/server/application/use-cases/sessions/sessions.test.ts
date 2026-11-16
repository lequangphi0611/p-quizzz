import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidSessionTransitionError,
  SessionNotFoundError,
  UngradedEssaysError,
  UnsupportedSessionModeError,
} from '../../../domain/session/errors.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { defaultSessionName } from '../../../domain/session/session-name.js';
import { defaultSessionModes, SelfPacedMode, StaticSessionModes, type SessionMode } from '../../../domain/session/mode.js';
import { FakeClock, FakeRandom, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryGroupRepository } from '../../testing/in-memory-group-repository.js';
import { AddRosterEmails, SaveSessionGroup } from './roster.js';
import { CreateGroup } from '../groups/groups.js';
import { EmptyEmailListError, GroupNameTakenError, GroupNotFoundError, InvalidEmailsError, NotRosterSessionError, RosterAlreadySavedError } from '../../../domain/group/errors.js';
import { FakeAttemptAutoSubmitter, FakeUngradedEssayCounter, InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { ImportExam } from '../exams/import-exam.js';
import { CloseSession } from './close-session.js';
import { CreateSession } from './create-session.js';
import { FinalizeSession } from './finalize-session.js';
import { OpenSession } from './open-session.js';
import { GetPublicSession, GetSessionDetail, ListSessions } from './queries.js';
import { ListScreenSessions } from './list-screen-sessions.js';
import { ResolveRoom } from './resolve-room.js';
import { WrongRoomCodeError } from '../../../domain/participant/errors.js';
import { StartSession } from './start-session.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';

const withEssay = readFileSync('exams/examples/git-co-ban.md', 'utf8');
const noEssay = '---\ntitle: Không tự luận\n---\n\n## Câu 1 {points: 1}\n- [x] A\n- [ ] B\n';

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let groups: InMemoryGroupRepository;
let submitter: FakeAttemptAutoSubmitter;
let grading: FakeUngradedEssayCounter;
let events: RecordingEventPublisher;
let clock: FakeClock;

function build(modes: SessionModeRegistry = defaultSessionModes()) {
  const unitOfWork = new InMemoryUnitOfWork({ sessions, exams, attempts: submitter, grading, groups }, [sessions, groups]);
  const deps = { unitOfWork, sessions, clock, random: new FakeRandom([111111, 222222, 333333, 444444, 555555]), events, modes };
  const examUow = new InMemoryUnitOfWork({ exams }, [exams]);
  return {
    importExam: new ImportExam({ unitOfWork: examUow, exams, clock }),
    create: new CreateSession({ unitOfWork, sessions, clock, modes }),
    list: new ListSessions(sessions),
    get: new GetSessionDetail(sessions),
    open: new OpenSession(deps),
    start: new StartSession(deps),
    close: new CloseSession(deps),
    finalize: new FinalizeSession(deps),
    publicSession: new GetPublicSession(sessions),
    addRoster: new AddRosterEmails({ unitOfWork, sessions, events }),
    saveGroup: new SaveSessionGroup({ unitOfWork, sessions, events, groups, clock }),
    createGroup: new CreateGroup({ unitOfWork: new InMemoryUnitOfWork({ groups }, [groups]), groups, clock }),
    resolve: new ResolveRoom(sessions),
    screen: new ListScreenSessions(sessions),
  };
}

beforeEach(() => {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  groups = new InMemoryGroupRepository();
  submitter = new FakeAttemptAutoSubmitter();
  grading = new FakeUngradedEssayCounter();
  events = new RecordingEventPublisher();
  clock = new FakeClock(1000);
});

describe('CreateSession / queries', () => {
  it('creates a draft self-paced session, shuffle on and auto-approve off by default', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(withEssay);
    const s = await uc.create.execute({ examId: exam.id });
    expect(s).toMatchObject({ examTitle: exam.title, name: defaultSessionName(exam.title, new Date(1000)), slot: null, mode: 'self_paced', status: 'draft', shuffle: true, autoApprove: false, roomCode: null, createdAt: new Date(1000) });
    expect((await uc.create.execute({ examId: exam.id, shuffle: false, autoApprove: true })).shuffle).toBe(false);
  });

  it('ExamNotFoundError for an unknown exam; SessionNotFoundError for an unknown session', async () => {
    const uc = build();
    await expect(uc.create.execute({ examId: 9 })).rejects.toBeInstanceOf(ExamNotFoundError);
    await expect(uc.get.execute(9)).rejects.toBeInstanceOf(SessionNotFoundError);
    await expect(uc.open.execute(9)).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('lists newest first; listActive follows only open sessions by slot', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(withEssay);
    const a = await uc.create.execute({ examId: exam.id });
    clock.advance(10);
    const b = await uc.create.execute({ examId: exam.id });
    expect((await uc.list.execute()).map(s => s.id)).toEqual([b.id, a.id]);
    expect(await uc.list.execute(true)).toEqual([]);
    await uc.open.execute(a.id);
    expect((await uc.list.execute(true)).map(s => s.id)).toEqual([a.id]);
    await uc.start.execute(a.id);
    await uc.close.execute(a.id);
    expect(await uc.list.execute(true)).toEqual([]);
    expect(await uc.publicSession.execute(a.id)).toMatchObject({ id: a.id, status: 'closed', title: exam.title });
    await expect(uc.publicSession.execute(99)).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});

describe('lifecycle', () => {
  async function draft(markdown = withEssay) {
    const uc = build();
    const { exam } = await uc.importExam.execute(markdown);
    return { uc, id: (await uc.create.execute({ examId: exam.id })).id };
  }

  it('open assigns a room code and the timestamp, then publishes "session"', async () => {
    const { uc, id } = await draft();
    const s = await uc.open.execute(id);
    expect(s).toMatchObject({ status: 'lobby', roomCode: '111111', openedAt: new Date(1000) });
    expect(events.events).toEqual([{ sessionId: id, type: 'session' }]);
  });

  it('sessions run side by side: each gets its own room code and the lowest free slot', async () => {
    const { uc, id } = await draft();
    const examId = (await sessions.findById(id))!.examId;
    const b = await uc.create.execute({ examId });
    const c = await uc.create.execute({ examId });
    const [a1, b1, c1] = [await uc.open.execute(id), await uc.open.execute(b.id), await uc.open.execute(c.id)];
    expect([a1.slot, b1.slot, c1.slot]).toEqual([1, 2, 3]);
    expect(new Set([a1.roomCode, b1.roomCode, c1.roomCode]).size).toBe(3);
    // Closing frees a slot; the next session to open takes the lowest free one.
    await uc.start.execute(b.id);
    expect((await uc.close.execute(b.id)).slot).toBeNull();
    const d = await uc.create.execute({ examId });
    expect((await uc.open.execute(d.id)).slot).toBe(2);
    expect((await uc.list.execute(true)).map(s => s.slot)).toEqual([1, 2, 3]); // the freed 2 went to d
  });

  it('resolves a member\'s room code to the open session, exam title only; anything else looks like a wrong code', async () => {
    const { uc, id } = await draft();
    const opened = await uc.open.execute(id);
    expect(await uc.resolve.execute(opened.roomCode!)).toEqual({ id, title: opened.examTitle, status: 'lobby', access: 'free' });
    await expect(uc.resolve.execute('000000')).rejects.toBeInstanceOf(WrongRoomCodeError);
    await uc.start.execute(id);
    await uc.close.execute(id);
    await expect(uc.resolve.execute(opened.roomCode!)).rejects.toBeInstanceOf(WrongRoomCodeError); // closed sessions are not discoverable
  });

  it('the projector chooser lists open sessions with their names; the latest ended one only when none is open', async () => {
    const { uc, id } = await draft();
    const examId = (await sessions.findById(id))!.examId;
    const named = await uc.create.execute({ examId, name: '  Lớp 0908  ' });
    expect(named.name).toBe('Lớp 0908');
    expect(await uc.screen.execute()).toEqual({ open: [], latestEnded: null });
    await uc.open.execute(named.id);
    const { open, latestEnded } = await uc.screen.execute();
    expect(open).toMatchObject([{ id: named.id, name: 'Lớp 0908', slot: 1, status: 'lobby' }]);
    expect(latestEnded).toBeNull();
    await uc.start.execute(named.id);
    await uc.close.execute(named.id);
    expect(await uc.screen.execute()).toMatchObject({ open: [], latestEnded: { id: named.id, status: expect.stringMatching(/closed|finalized/) } });
  });

  it('a wrong transition is a conflict and changes nothing', async () => {
    const { uc, id } = await draft();
    await expect(uc.start.execute(id)).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    await expect(uc.close.execute(id)).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    await expect(uc.finalize.execute(id)).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    expect((await uc.get.execute(id)).status).toBe('draft');
    expect(events.events).toEqual([]);
    expect(submitter.calls).toEqual([]);
  });

  it('close submits open attempts, publishes leaderboard and participants only when something was submitted', async () => {
    const { uc, id } = await draft();
    await uc.open.execute(id);
    await uc.start.execute(id);
    events.events.length = 0;
    submitter.result = 2;
    const s = await uc.close.execute(id);
    expect(submitter.calls).toEqual([id]);
    expect(s).toMatchObject({ status: 'closed', closedAt: new Date(1000), finalizedAt: null });
    expect(events.events.map(e => e.type)).toEqual(['session', 'leaderboard', 'participants']);
  });

  it('close finalizes at once for an exam without essays', async () => {
    const { uc, id } = await draft(noEssay);
    await uc.open.execute(id);
    await uc.start.execute(id);
    expect(await uc.close.execute(id)).toMatchObject({ status: 'finalized', finalizedAt: new Date(1000) });
  });

  it('finalize needs every essay graded; the session stays closed otherwise', async () => {
    const { uc, id } = await draft();
    await uc.open.execute(id);
    await uc.start.execute(id);
    await uc.close.execute(id);
    grading.missing = 3;
    const err = await uc.finalize.execute(id).catch(e => e);
    expect(err).toBeInstanceOf(UngradedEssaysError);
    expect(err.message).toBe('Còn 3 bài tự luận chưa chấm điểm');
    expect((await uc.get.execute(id)).status).toBe('closed');
    grading.missing = 0;
    expect(await uc.finalize.execute(id)).toMatchObject({ status: 'finalized' });
  });

  it('a failure inside the unit rolls back the whole transition', async () => {
    const { uc, id } = await draft();
    await uc.open.execute(id);
    await uc.start.execute(id);
    submitter.submitOpenAttempts = async () => { throw new Error('boom'); };
    await expect(uc.close.execute(id)).rejects.toThrow('boom');
    expect((await uc.get.execute(id)).status).toBe('running');
  });
});

describe('session modes (strategy)', () => {
  // A stand-in for the phase-2 live mode: it never sweeps attempts and never finalizes on close.
  const FakeLiveMode: SessionMode = { id: 'live', submitsOpenAttemptsOnClose: false, statusAfterClose: () => 'closed' };

  it('a new mode plugs in through the registry without changing any use case', async () => {
    const uc = build(new StaticSessionModes([SelfPacedMode, FakeLiveMode]));
    const { exam } = await uc.importExam.execute(noEssay);
    const { id } = await uc.create.execute({ examId: exam.id, mode: 'live' });
    await uc.open.execute(id);
    await uc.start.execute(id);
    submitter.result = 5;
    const s = await uc.close.execute(id);
    expect(submitter.calls).toEqual([]); // the mode opted out of the sweep
    expect(s.status).toBe('closed'); // self-paced would have finalized this essay-free exam
  });

  it('an unregistered mode is rejected', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(noEssay);
    await expect(uc.create.execute({ examId: exam.id, mode: 'live' })).rejects.toBeInstanceOf(UnsupportedSessionModeError);
  });
});

describe('sessions with a list of emails (PRODUCT.md §7.22)', () => {
  async function setup() {
    const uc = build();
    const { exam } = await uc.importExam.execute(withEssay);
    return { uc, examId: exam.id };
  }

  it('free by default: no list, anyone with the code may try', async () => {
    const { uc, examId } = await setup();
    const s = await uc.create.execute({ examId });
    expect(s).toMatchObject({ access: 'free', outsiderPolicy: 'block', rosterSource: null, roster: null });
  });

  it('typed list ("Danh sách tạm"): cleaned, copied into the session, flagged as unsaved; auto-approve is ignored', async () => {
    const { uc, examId } = await setup();
    const s = await uc.create.execute({ examId, autoApprove: true, access: { kind: 'emails', emails: [' Phi78@Gmail.com', 'phi89@gmail.com', 'phi78@gmail.com'] } });
    expect(s).toMatchObject({ access: 'roster', autoApprove: false, outsiderPolicy: 'block', rosterSource: 'temp', roster: { size: 2, joined: 0, notJoined: ['phi78@gmail.com', 'phi89@gmail.com'] } });
    expect(await sessions.hasRosterEmail(s.id, 'phi78@gmail.com')).toBe(true);
  });

  it('refuses a typed list with a bad line or nothing in it, creating no session', async () => {
    const { uc, examId } = await setup();
    await expect(uc.create.execute({ examId, access: { kind: 'emails', emails: ['a@x.com', 'phi89@'] } })).rejects.toBeInstanceOf(InvalidEmailsError);
    await expect(uc.create.execute({ examId, access: { kind: 'emails', emails: [] } })).rejects.toBeInstanceOf(EmptyEmailListError);
    expect(await uc.list.execute()).toEqual([]);
  });

  it('from a saved group: the list is COPIED, so editing or deleting the group later changes nothing in the session', async () => {
    const { uc, examId } = await setup();
    const g = await uc.createGroup.execute({ name: '#member-0908', emails: ['an@x.com', 'binh@x.com'] });
    const s = await uc.create.execute({ examId, access: { kind: 'group', groupId: g.id }, outsiderPolicy: 'pending' });
    expect(s).toMatchObject({ access: 'roster', outsiderPolicy: 'pending', rosterSource: 'group', roster: { size: 2 } });
    await groups.replace(g.id, { name: 'đổi tên', emails: ['chi@x.com'], now: new Date(0) });
    expect(await sessions.rosterEmails(s.id)).toEqual(['an@x.com', 'binh@x.com']);
    await groups.remove(g.id);
    expect(await sessions.hasRosterEmail(s.id, 'an@x.com')).toBe(true);
  });

  it('a group that does not exist stops the creation', async () => {
    const { uc, examId } = await setup();
    await expect(uc.create.execute({ examId, access: { kind: 'group', groupId: 99 } })).rejects.toBeInstanceOf(GroupNotFoundError);
    expect(await uc.list.execute()).toEqual([]);
  });

  it('the mentor can add emails to ONE running session without touching its group; free and ended sessions refuse', async () => {
    const { uc, examId } = await setup();
    const g = await uc.createGroup.execute({ name: 'Lớp', emails: ['an@x.com'] });
    const s = await uc.create.execute({ examId, access: { kind: 'group', groupId: g.id } });
    await uc.open.execute(s.id);
    const after = await uc.addRoster.execute(s.id, ['Linh@Company.vn', 'an@x.com']);
    expect(after.roster).toMatchObject({ size: 2, notJoined: ['an@x.com', 'linh@company.vn'] });
    expect(events.events.at(-1)).toEqual({ sessionId: s.id, type: 'participants' });
    expect((await groups.find(g.id))!.emails).toEqual(['an@x.com']); // the saved group is not touched

    const free = await uc.create.execute({ examId });
    await expect(uc.addRoster.execute(free.id, ['a@x.com'])).rejects.toBeInstanceOf(NotRosterSessionError);
    await uc.start.execute(s.id);
    await uc.close.execute(s.id);
    await expect(uc.addRoster.execute(s.id, ['z@x.com'])).rejects.toThrow('Phiên đã kết thúc');
  });

  it('a typed list can be saved as a group once; the name must be free', async () => {
    const { uc, examId } = await setup();
    const s = await uc.create.execute({ examId, access: { kind: 'emails', emails: ['an@x.com', 'binh@x.com'] } });
    const saved = await uc.saveGroup.execute(s.id, '#docker-1511');
    expect(saved).toMatchObject({ name: '#docker-1511', emailCount: 2, emails: ['an@x.com', 'binh@x.com'] });
    expect((await uc.get.execute(s.id)).rosterSource).toBe('group');
    await expect(uc.saveGroup.execute(s.id, 'khác')).rejects.toBeInstanceOf(RosterAlreadySavedError);

    const other = await uc.create.execute({ examId, access: { kind: 'emails', emails: ['c@x.com'] } });
    await expect(uc.saveGroup.execute(other.id, ' #DOCKER-1511 ')).rejects.toBeInstanceOf(GroupNameTakenError);
    const free = await uc.create.execute({ examId });
    await expect(uc.saveGroup.execute(free.id, 'x')).rejects.toBeInstanceOf(NotRosterSessionError);
    await expect(uc.saveGroup.execute(99, 'x')).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});
