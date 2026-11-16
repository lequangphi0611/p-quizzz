import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AnotherSessionActiveError,
  InvalidSessionTransitionError,
  SessionNotFoundError,
  UngradedEssaysError,
  UnsupportedSessionModeError,
} from '../../../domain/session/errors.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { defaultSessionModes, SelfPacedMode, StaticSessionModes, type SessionMode } from '../../../domain/session/mode.js';
import { FakeClock, FakeRandom, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { FakeAttemptAutoSubmitter, FakeUngradedEssayCounter, InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { ImportExam } from '../exams/import-exam.js';
import { CloseSession } from './close-session.js';
import { CreateSession } from './create-session.js';
import { FinalizeSession } from './finalize-session.js';
import { OpenSession } from './open-session.js';
import { GetActiveSession, GetLatestSession, GetSessionDetail, ListSessions } from './queries.js';
import { StartSession } from './start-session.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';

const withEssay = readFileSync('exams/examples/git-co-ban.md', 'utf8');
const noEssay = '---\ntitle: Không tự luận\n---\n\n## Câu 1 {points: 1}\n- [x] A\n- [ ] B\n';

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let submitter: FakeAttemptAutoSubmitter;
let grading: FakeUngradedEssayCounter;
let events: RecordingEventPublisher;
let clock: FakeClock;

function build(modes: SessionModeRegistry = defaultSessionModes()) {
  const unitOfWork = new InMemoryUnitOfWork({ sessions, exams, attempts: submitter, grading }, [sessions]);
  const deps = { unitOfWork, sessions, clock, random: new FakeRandom([111111, 222222, 333333]), events, modes };
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
    active: new GetActiveSession(sessions),
    latest: new GetLatestSession(sessions),
  };
}

beforeEach(() => {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
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
    expect(s).toMatchObject({ examTitle: exam.title, mode: 'self_paced', status: 'draft', shuffle: true, autoApprove: false, roomCode: null, createdAt: new Date(1000) });
    expect((await uc.create.execute({ examId: exam.id, shuffle: false, autoApprove: true })).shuffle).toBe(false);
  });

  it('ExamNotFoundError for an unknown exam; SessionNotFoundError for an unknown session', async () => {
    const uc = build();
    await expect(uc.create.execute({ examId: 9 })).rejects.toBeInstanceOf(ExamNotFoundError);
    await expect(uc.get.execute(9)).rejects.toBeInstanceOf(SessionNotFoundError);
    await expect(uc.open.execute(9)).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('lists newest first and reports the active and latest sessions', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(withEssay);
    const a = await uc.create.execute({ examId: exam.id });
    clock.advance(10);
    const b = await uc.create.execute({ examId: exam.id });
    expect((await uc.list.execute()).map(s => s.id)).toEqual([b.id, a.id]);
    expect(await uc.active.execute()).toBeNull();
    await uc.open.execute(a.id);
    expect(await uc.active.execute()).toMatchObject({ id: a.id, status: 'lobby' });
    await uc.start.execute(a.id);
    await uc.close.execute(a.id);
    expect(await uc.active.execute()).toBeNull();
    expect(await uc.latest.execute()).toMatchObject({ id: a.id, status: 'closed' });
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

  it('only one session may be active', async () => {
    const { uc, id } = await draft();
    const other = await uc.create.execute({ examId: (await sessions.findById(id))!.examId });
    await uc.open.execute(id);
    await expect(uc.open.execute(other.id)).rejects.toBeInstanceOf(AnotherSessionActiveError);
    expect((await uc.get.execute(other.id)).status).toBe('draft');
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
