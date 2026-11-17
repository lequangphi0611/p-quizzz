import { beforeEach, describe, expect, it } from 'vitest';
import { TIME_UP_GRACE_MS } from '../../../../shared/session-timer.js';
import { CannotExtendTimeError, TimeLimitLockedError } from '../../../domain/session/errors.js';
import { defaultSessionModes } from '../../../domain/session/mode.js';
import { FakeClock, FakeRandom, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryGroupRepository } from '../../testing/in-memory-group-repository.js';
import { FakeAttemptAutoSubmitter, FakeUngradedEssayCounter, InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { ImportExam } from '../exams/import-exam.js';
import { CloseSession } from './close-session.js';
import { CreateSession } from './create-session.js';
import { OpenSession } from './open-session.js';
import { StartSession } from './start-session.js';
import { CloseExpiredSessions, ExtendTime, SetTimeLimit } from './time-limit.js';

const MIN = 60_000;
const exam = (duration = '') => `---\ntitle: Đề có giờ\n${duration ? `duration: ${duration}\n` : ''}---\n\n## Câu 1\n- [x] A\n- [ ] B\n> vì A\n`;

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let submitter: FakeAttemptAutoSubmitter;
let events: RecordingEventPublisher;
let clock: FakeClock;

function build() {
  const unitOfWork = new InMemoryUnitOfWork({ sessions, exams, attempts: submitter, grading: new FakeUngradedEssayCounter(), groups: new InMemoryGroupRepository() }, [sessions]);
  const modes = defaultSessionModes();
  const deps = { unitOfWork, sessions, clock, random: new FakeRandom([111111, 222222, 333333]), events, modes };
  return {
    importExam: new ImportExam({ unitOfWork: new InMemoryUnitOfWork({ exams }, [exams]), exams, clock }),
    create: new CreateSession({ unitOfWork, sessions, clock, modes }),
    open: new OpenSession(deps),
    start: new StartSession(deps),
    close: new CloseSession(deps),
    setTimeLimit: new SetTimeLimit({ unitOfWork, sessions, events, clock }),
    extend: new ExtendTime({ unitOfWork, sessions, events, clock }),
    closeExpired: new CloseExpiredSessions(deps),
  };
}

beforeEach(() => {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  submitter = new FakeAttemptAutoSubmitter();
  events = new RecordingEventPublisher();
  clock = new FakeClock(1000);
});

describe('session time limit (PRODUCT.md §7.27)', () => {
  it('a new session takes the exam duration by default; the mentor may set another value or none', async () => {
    const uc = build();
    const timed = (await uc.importExam.execute(exam('45'))).exam;
    const untimed = (await uc.importExam.execute(exam())).exam;
    expect(timed.durationMinutes).toBe(45);
    expect((await uc.create.execute({ examId: timed.id })).timeLimitMinutes).toBe(45);
    expect((await uc.create.execute({ examId: timed.id, timeLimitMinutes: 20 })).timeLimitMinutes).toBe(20);
    expect((await uc.create.execute({ examId: timed.id, timeLimitMinutes: null })).timeLimitMinutes).toBeNull();
    expect((await uc.create.execute({ examId: untimed.id })).timeLimitMinutes).toBeNull();
    expect((await uc.create.execute({ examId: untimed.id, timeLimitMinutes: 15 })).timeLimitMinutes).toBe(15);
  });

  it('changes freely in draft and lobby, never after the start', async () => {
    const uc = build();
    const { id } = await uc.create.execute({ examId: (await uc.importExam.execute(exam('30'))).exam.id });
    expect((await uc.setTimeLimit.execute(id, 10)).timeLimitMinutes).toBe(10);
    await uc.open.execute(id);
    expect((await uc.setTimeLimit.execute(id, null)).timeLimitMinutes).toBeNull();
    expect((await uc.setTimeLimit.execute(id, 25)).timeLimitMinutes).toBe(25);
    expect(events.events.at(-1)).toEqual({ sessionId: id, type: 'session' });
    await uc.start.execute(id);
    await expect(uc.setTimeLimit.execute(id, 60)).rejects.toBeInstanceOf(TimeLimitLockedError);
  });

  it('start fixes one deadline for everyone; "+5 phút" moves it for everyone', async () => {
    const uc = build();
    const { id } = await uc.create.execute({ examId: (await uc.importExam.execute(exam('30'))).exam.id });
    await uc.open.execute(id);
    clock.advance(MIN);
    const started = await uc.start.execute(id);
    expect(started.endsAt).toEqual(new Date(1000 + MIN + 30 * MIN));
    const extended = await uc.extend.execute(id, 5);
    expect(extended.endsAt).toEqual(new Date(1000 + MIN + 35 * MIN));
    expect(extended.timeLimitMinutes).toBe(35);
    expect(events.events.at(-1)).toEqual({ sessionId: id, type: 'session' });
  });

  it('cannot add time to a session without a limit, or before it runs', async () => {
    const uc = build();
    const untimed = await uc.create.execute({ examId: (await uc.importExam.execute(exam())).exam.id });
    await uc.open.execute(untimed.id);
    await uc.start.execute(untimed.id);
    await expect(uc.extend.execute(untimed.id, 5)).rejects.toBeInstanceOf(CannotExtendTimeError);
    const timed = await uc.create.execute({ examId: untimed.examId, timeLimitMinutes: 10 });
    await expect(uc.extend.execute(timed.id, 5)).rejects.toBeInstanceOf(CannotExtendTimeError);
  });

  it('closes a session once its deadline and the grace period have passed, submitting open work, like "Đóng"', async () => {
    const uc = build();
    const examId = (await uc.importExam.execute(exam())).exam.id;
    const timed = await uc.create.execute({ examId, timeLimitMinutes: 10 });
    const untimed = await uc.create.execute({ examId });
    for (const s of [timed, untimed]) { await uc.open.execute(s.id); await uc.start.execute(s.id); }
    submitter.result = 2;

    clock.advance(10 * MIN + TIME_UP_GRACE_MS - 1);
    expect(await uc.closeExpired.execute()).toEqual([]);
    clock.advance(1);
    expect(await uc.closeExpired.execute()).toEqual([timed.id]);
    expect(submitter.calls).toEqual([timed.id]);
    expect((await sessions.findById(timed.id))?.status).toBe('finalized'); // no essay: closing finalizes at once
    expect((await sessions.findById(untimed.id))?.status).toBe('running');
    expect(events.events.filter(e => e.sessionId === timed.id).slice(-3).map(e => e.type)).toEqual(['session', 'leaderboard', 'participants']);
    expect(await uc.closeExpired.execute()).toEqual([]); // nothing twice
  });

  it('time added before the watcher runs wins; a session the mentor closed is left alone', async () => {
    const uc = build();
    const examId = (await uc.importExam.execute(exam())).exam.id;
    const a = await uc.create.execute({ examId, timeLimitMinutes: 1 });
    const b = await uc.create.execute({ examId, timeLimitMinutes: 1 });
    for (const s of [a, b]) { await uc.open.execute(s.id); await uc.start.execute(s.id); }
    clock.advance(MIN + TIME_UP_GRACE_MS);
    await uc.extend.execute(a.id, 5);
    await uc.close.execute(b.id);
    expect(await uc.closeExpired.execute()).toEqual([]);
    expect((await sessions.findById(a.id))?.status).toBe('running');
  });
});
