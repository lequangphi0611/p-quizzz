import { beforeEach, describe, expect, it } from 'vitest';
import { SessionNotSharedError, ShareLinkInvalidError, ShareNotAllowedError } from '../../../domain/sharing/sharing.js';
import { FakeClock, FakeTokenGenerator } from '../../testing/fakes.js';
import { InMemoryAttemptRepository } from '../../testing/in-memory-attempt-repository.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryGroupRepository } from '../../testing/in-memory-group-repository.js';
import { InMemoryParticipantRepository } from '../../testing/in-memory-participant-repository.js';
import { FakeAttemptAutoSubmitter, FakeUngradedEssayCounter, InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryShareTokenStore } from '../../testing/in-memory-share-token-store.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { ImportExam } from '../exams/import-exam.js';
import { SetSessionShared } from './set-session-shared.js';
import { GetShareLink, RotateShareLink } from './share-link.js';
import { GetSharedSession, ListSharedSessions } from './shared-sessions.js';

const markdown = '---\ntitle: Ôn tập\n---\n\n## Câu 1\n- [x] A\n- [ ] B\n> Vì A.\n';

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let store: InMemoryShareTokenStore;
let clock: FakeClock;
let uc: ReturnType<typeof build>;

function build() {
  const participants = new InMemoryParticipantRepository();
  const attempts = new InMemoryAttemptRepository(participants);
  const unitOfWork = new InMemoryUnitOfWork({ sessions, lobby: participants, exams, attempts: new FakeAttemptAutoSubmitter(), grading: new FakeUngradedEssayCounter(), groups: new InMemoryGroupRepository() }, [sessions]);
  const linkDeps = { store, tokens: new FakeTokenGenerator(), shared: sessions };
  return {
    setShared: new SetSessionShared({ unitOfWork, sessions, clock }),
    link: new GetShareLink(linkDeps),
    rotate: new RotateShareLink(linkDeps),
    list: new ListSharedSessions({ store, shared: sessions }),
    get: new GetSharedSession({ store, sessions, attempts, exams }),
  };
}

async function newSession(status: 'running' | 'closed') {
  const { exam: { id: examId } } = await new ImportExam({ unitOfWork: new InMemoryUnitOfWork({ exams }, [exams]), exams, clock }).execute(markdown);
  const id = await sessions.create({ examId, name: 'Nhóm A – bí mật', mode: 'self_paced', shuffle: false, autoApprove: false, access: { kind: 'free' } as never, outsiderPolicy: 'block', sourceGroupId: null, scoreVisibility: 'on_submit', timeLimitMinutes: null, createdAt: clock.now() });
  await sessions.update(id, { status, startedAt: clock.now() });
  return id;
}

beforeEach(() => {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  store = new InMemoryShareTokenStore();
  clock = new FakeClock(5000);
  uc = build();
});

describe('SetSessionShared', () => {
  it('refuses a session that has not ended, and changes nothing', async () => {
    const id = await newSession('running');
    await expect(uc.setShared.execute(id, true)).rejects.toThrow(ShareNotAllowedError);
    expect((await sessions.findById(id))!.sharedAt).toBeNull();
  });

  it('shares an ended session at the current time and keeps that time when shared again', async () => {
    const id = await newSession('closed');
    expect((await uc.setShared.execute(id, true)).sharedAt).toEqual(new Date(5000));
    clock.advance(1000);
    expect((await uc.setShared.execute(id, true)).sharedAt).toEqual(new Date(5000));
    expect((await uc.setShared.execute(id, false)).sharedAt).toBeNull();
  });
});

describe('share link and page', () => {
  it('makes one token, keeps it, and replaces it on rotate', async () => {
    const first = await uc.link.execute();
    expect(first).toEqual({ token: 'token-1', sharedCount: 0 });
    expect((await uc.link.execute()).token).toBe('token-1');
    expect((await uc.rotate.execute()).token).toBe('token-2');
    await expect(uc.list.execute('token-1')).rejects.toThrow(ShareLinkInvalidError);
  });

  it('a wrong token is refused even before any token exists', async () => {
    await expect(uc.list.execute('anything')).rejects.toThrow(ShareLinkInvalidError);
    await expect(uc.get.execute('anything', 1)).rejects.toThrow(ShareLinkInvalidError);
  });

  it('lists shared sessions by exam title and reads one; unshared ones are not found', async () => {
    const id = await newSession('closed');
    const { token } = await uc.link.execute();
    await expect(uc.get.execute(token, id)).rejects.toThrow(SessionNotSharedError);
    await uc.setShared.execute(id, true);
    expect(await uc.list.execute(token)).toEqual({ sessions: [{ id, examTitle: 'Ôn tập', startedAt: 5000, questionCount: 1 }] });
    const view = await uc.get.execute(token, id);
    expect(view).toMatchObject({ id, examTitle: 'Ôn tập', submitted: 0, questionCount: 1 });
    expect(view.questions[0]).toMatchObject({ explanation: expect.stringContaining('Vì A'), distribution: null });
    expect(JSON.stringify(view)).not.toContain('Nhóm A');
    await expect(uc.get.execute(token, 999)).rejects.toThrow(SessionNotSharedError);
  });
});
