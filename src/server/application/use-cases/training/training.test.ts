import { beforeEach, describe, expect, it } from 'vitest';
import { NameTakenError, WrongRoomCodeError } from '../../../domain/participant/errors.js';
import { TrainingMemberNotFoundError, TrainingNotFoundError, TrainingNotJoinedError, TrainingStateError } from '../../../domain/training/errors.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingTrainingSignals } from '../../testing/fakes.js';
import { InMemoryTrainingEventRepository } from '../../testing/in-memory-training-event-repository.js';
import { InMemoryTrainingMemberRepository, InMemoryTrainingRepository } from '../../testing/in-memory-training-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { CreateTraining, EndTraining, GetTrainingDetail, ListTrainings, PurgeTrainingMember, RemoveTrainingMember, StopTraining } from './admin.js';
import { GetHookConfig, GetMyTraining, JoinTraining, ResumeTrainingMember, WithdrawTrainingConsent } from './member.js';
import { ResolveAnyRoom } from './resolve-any-room.js';

let members: InMemoryTrainingMemberRepository;
let trainings: InMemoryTrainingRepository;
let events: InMemoryTrainingEventRepository;
let signals: RecordingTrainingSignals;
let clock: FakeClock;

function build(randoms = [111111, 222222]) {
  const unitOfWork = new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]);
  const deps = { unitOfWork, clock, signals };
  return {
    create: new CreateTraining({ ...deps, random: new FakeRandom(randoms) }),
    list: new ListTrainings(trainings),
    detail: new GetTrainingDetail({ trainings, members, events }),
    stop: new StopTraining(deps),
    end: new EndTraining(deps),
    remove: new RemoveTrainingMember(deps),
    purge: new PurgeTrainingMember(deps),
    join: new JoinTraining({ ...deps, tokens: new FakeTokenGenerator() }),
    resume: new ResumeTrainingMember({ members, trainings }),
    me: new GetMyTraining(),
    hookConfig: new GetHookConfig(),
    withdraw: new WithdrawTrainingConsent(deps),
  };
}

beforeEach(() => {
  members = new InMemoryTrainingMemberRepository();
  trainings = new InMemoryTrainingRepository(members);
  events = new InMemoryTrainingEventRepository(members);
  signals = new RecordingTrainingSignals();
  clock = new FakeClock(1000);
});

describe('CreateTraining / ListTrainings', () => {
  it('opens at once with a 6-digit code, signals, and lists newest first', async () => {
    const uc = build();
    const a = await uc.create.execute('Buổi 1');
    expect(a).toMatchObject({ name: 'Buổi 1', status: 'open', roomCode: '111111', createdAt: new Date(1000) });
    clock.advance(10);
    const b = await uc.create.execute('Buổi 2');
    expect(b.roomCode).toBe('222222');
    expect(signals.signals).toEqual([a.id, b.id]);
    expect((await uc.list.execute()).map(t => t.name)).toEqual(['Buổi 2', 'Buổi 1']);
  });

  it('never reuses a code held by an open training or by a session', async () => {
    const uc = build([111111, 111111, 333333]);
    await uc.create.execute('A');
    expect((await uc.create.execute('B')).roomCode).toBe('333333'); // 111111 is taken: draws again
    trainings.sessionCodes.add('444444');
    const next = build([444444, 555555]);
    expect((await next.create.execute('C')).roomCode).toBe('555555');
  });
});

describe('JoinTraining', () => {
  it('adds a member with two different tokens and signals', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    signals.signals.length = 0;
    const { token, member } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    expect(token).toBe('token-1');
    expect(member).toMatchObject({ displayName: 'Lan', token: 'token-1', ingestToken: 'token-2', consentedAt: new Date(1000), firstSeenAt: null });
    expect(signals.signals).toEqual([t.id]);
  });

  it('a wrong code, an unknown training and a stopped one all look the same (WrongRoomCode, nothing signalled)', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    signals.signals.length = 0;
    await expect(uc.join.execute({ trainingId: t.id, displayName: 'x', roomCode: '000000' })).rejects.toBeInstanceOf(WrongRoomCodeError);
    await expect(uc.join.execute({ trainingId: 99, displayName: 'x', roomCode: '111111' })).rejects.toBeInstanceOf(WrongRoomCodeError);
    await uc.stop.execute(t.id);
    signals.signals.length = 0;
    await expect(uc.join.execute({ trainingId: t.id, displayName: 'x', roomCode: '111111' })).rejects.toBeInstanceOf(WrongRoomCodeError);
    expect(signals.signals).toEqual([]);
  });

  it('refuses a name already in the training, in any letter case, as identity_in_use', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    await uc.join.execute({ trainingId: t.id, displayName: 'Đạt', roomCode: '111111' });
    const err = await uc.join.execute({ trainingId: t.id, displayName: 'đạt', roomCode: '111111' }).catch(e => e);
    expect(err).toBeInstanceOf(NameTakenError);
    expect(err.code).toBe('identity_in_use');
  });
});

describe('Stop / End', () => {
  it('stop frees the code at once; end deletes members and keeps name, times and member count', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111' });

    clock.advance(500);
    expect(await uc.stop.execute(t.id)).toMatchObject({ status: 'stopped', roomCode: null, stoppedAt: new Date(1500) });
    expect(await trainings.findOpenByRoomCode('111111')).toBeNull();

    clock.advance(500);
    expect(await uc.end.execute(t.id)).toMatchObject({ status: 'ended', endedAt: new Date(2000), memberCount: 2, name: 'T' });
    expect(await members.listByTraining(t.id)).toEqual([]);
    const detail = await uc.detail.execute(t.id);
    expect(detail.members).toEqual([]);
    expect((await uc.list.execute())[0]).toMatchObject({ memberCount: 2, liveMemberCount: 0 });
  });

  it('out-of-order steps are 409 and change nothing', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    await expect(uc.end.execute(t.id)).rejects.toBeInstanceOf(TrainingStateError);
    await uc.stop.execute(t.id);
    await expect(uc.stop.execute(t.id)).rejects.toBeInstanceOf(TrainingStateError);
    await uc.end.execute(t.id);
    await expect(uc.end.execute(t.id)).rejects.toBeInstanceOf(TrainingStateError);
    await expect(uc.stop.execute(99)).rejects.toBeInstanceOf(TrainingNotFoundError);
  });
});

describe('GetTrainingDetail', () => {
  it('shows members as waiting with zero counts, and the removal count only once stopped', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    let detail = await uc.detail.execute(t.id);
    expect(detail.uninstalled).toBeNull();
    expect(detail.members).toEqual([{ id: 1, displayName: 'Lan', connection: 'waiting', lastSeenAt: null, promptCount: 0, toolCount: 0, failedCount: 0, stuck: false, stillSending: false, stoppedSending: false, flags: [], clearCount: 0, compactCount: 0, permissionCount: 0, mentorNote: null, markedCount: 0, teachingConsent: false }]);
    expect(Object.values(detail.flagCounts).every(n => n === 0)).toBe(true);
    await uc.stop.execute(t.id);
    detail = await uc.detail.execute(t.id);
    expect(detail.uninstalled).toEqual({ count: 0, total: 1 });
    await expect(uc.detail.execute(99)).rejects.toBeInstanceOf(TrainingNotFoundError);
  });
});

describe('RemoveTrainingMember / WithdrawTrainingConsent', () => {
  it('removing a member deletes them; only members of that training; not after the end', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const other = await uc.create.execute('Other');
    const { member } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await expect(uc.remove.execute(other.id, member.id)).rejects.toBeInstanceOf(TrainingMemberNotFoundError);
    await expect(uc.remove.execute(99, member.id)).rejects.toBeInstanceOf(TrainingNotFoundError);
    signals.signals.length = 0;
    await uc.remove.execute(t.id, member.id);
    expect(await members.findById(member.id)).toBeNull();
    expect(signals.signals).toEqual([t.id]);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    await expect(uc.remove.execute(t.id, member.id)).rejects.toBeInstanceOf(TrainingStateError);
  });

  it('"Dừng gửi" (withdraw) keeps the member and their events, records the time once and signals the mentor', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const { token, member } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await events.append({ kind: 'prompt', claudeSessionId: 's', permissionMode: null, promptId: null, prompt: 'hi', memberId: member.id, receivedAt: clock.now() });
    signals.signals.length = 0;
    clock.advance(500);
    await uc.withdraw.execute(await uc.resume.execute(token));
    expect((await members.findById(member.id))!.stoppedSendingAt).toEqual(new Date(1500));
    expect(await events.all()).toHaveLength(1);
    expect(signals.signals).toEqual([t.id]);
    clock.advance(500);
    await uc.withdraw.execute(await uc.resume.execute(token)); // asking again keeps the first time
    expect((await members.findById(member.id))!.stoppedSendingAt).toEqual(new Date(1500));
    // the token still works, so the member can see their state
    expect((await uc.resume.execute(token)).member.id).toBe(member.id);
  });

  it('the mentor sees the name of who stopped sending, as `stopped_sending`', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const { token } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111' });
    await uc.withdraw.execute(await uc.resume.execute(token));
    const rows = (await uc.detail.execute(t.id)).members;
    expect(rows.map(r => [r.displayName, r.connection, r.stoppedSending])).toEqual([['Lan', 'stopped_sending', true], ['Mai', 'waiting', false]]);
  });

  it('"Dừng gửi" is refused (409) once the training is stopped or ended', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const { token } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await uc.stop.execute(t.id);
    await expect(uc.withdraw.execute(await uc.resume.execute(token))).rejects.toBeInstanceOf(TrainingStateError);
  });

  it('purge deletes only a member who stopped sending (and their events); others are refused', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const lan = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    const mai = await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111' });
    await events.append({ kind: 'prompt', claudeSessionId: 's', permissionMode: null, promptId: null, prompt: 'hi', memberId: lan.member.id, receivedAt: clock.now() });
    await expect(uc.purge.execute(t.id, lan.member.id)).rejects.toBeInstanceOf(TrainingStateError); // has not stopped sending
    await uc.withdraw.execute(await uc.resume.execute(lan.token));
    await expect(uc.purge.execute(99, lan.member.id)).rejects.toBeInstanceOf(TrainingNotFoundError);
    await expect(uc.purge.execute(t.id, 99)).rejects.toBeInstanceOf(TrainingMemberNotFoundError);
    signals.signals.length = 0;
    await uc.purge.execute(t.id, lan.member.id);
    expect(await members.findById(lan.member.id)).toBeNull();
    expect(await events.all()).toEqual([]);
    expect(signals.signals).toEqual([t.id]);
    await expect(uc.resume.execute(lan.token)).rejects.toBeInstanceOf(TrainingNotJoinedError);
    expect(await members.findById(mai.member.id)).not.toBeNull();
  });

  it('purge still works after "Dừng thu" (the member stays until Kết thúc), not after the end', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const lan = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await uc.withdraw.execute(await uc.resume.execute(lan.token));
    await uc.stop.execute(t.id);
    await uc.purge.execute(t.id, lan.member.id);
    expect(await members.findById(lan.member.id)).toBeNull();
    await uc.end.execute(t.id);
    await expect(uc.purge.execute(t.id, lan.member.id)).rejects.toBeInstanceOf(TrainingStateError);
  });

  it('Kết thúc deletes everyone, including a member who stopped sending', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const lan = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    await uc.withdraw.execute(await uc.resume.execute(lan.token));
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    expect(await members.findById(lan.member.id)).toBeNull();
    expect((await trainings.findById(t.id))!.memberCount).toBe(1);
  });
});

describe('GetMyTraining / GetHookConfig', () => {
  it('my status carries no collected data and no ingest token', async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const { token } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    const view = uc.me.execute(await uc.resume.execute(token));
    expect(view).toEqual({ training: { id: t.id, name: 'T', status: 'open' }, member: { displayName: 'Lan', connection: 'waiting', uninstallCheck: 'none' } });
    expect(JSON.stringify(view)).not.toContain('token-2');
  });

  it("hook config holds the member's own ingest token; refused once the training is not open", async () => {
    const uc = build();
    const t = await uc.create.execute('T');
    const { token } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    const cfg = uc.hookConfig.execute(await uc.resume.execute(token), 'http://192.168.1.5:3000');
    expect(cfg.settings.hooks.PostToolUse[0]!.hooks[0]).toMatchObject({ url: 'http://192.168.1.5:3000/api/training/ingest', headers: { 'X-Training-Token': 'token-2' }, timeout: 1 });
    expect(cfg.mergePrompt).toContain('token-2');
    await uc.stop.execute(t.id);
    const stopped = await uc.resume.execute(token);
    expect(() => uc.hookConfig.execute(stopped, 'http://x')).toThrow(TrainingStateError);
  });
});

describe('ResolveAnyRoom', () => {
  const sessionStub = (open: string | null) => ({
    execute: async (code: string) => {
      if (code !== open) throw new WrongRoomCodeError();
      return { id: 7 } as never;
    },
  });

  it('finds a session first, then an open training; stopped or unknown codes are the same wrong-code error', async () => {
    const uc = build();
    const t = await uc.create.execute('Buổi X');
    const resolve = new ResolveAnyRoom({ session: sessionStub('999999'), trainings });
    expect(await resolve.execute('999999')).toEqual({ kind: 'session', session: { id: 7 } });
    expect(await resolve.execute('111111')).toEqual({ kind: 'training', id: t.id, title: 'Buổi X' });
    await expect(resolve.execute('000000')).rejects.toBeInstanceOf(WrongRoomCodeError);
    await uc.stop.execute(t.id);
    await expect(resolve.execute('111111')).rejects.toBeInstanceOf(WrongRoomCodeError);
  });
});
