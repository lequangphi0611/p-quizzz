import { beforeEach, describe, expect, it } from 'vitest';
import { TrainingCheckTooEarlyError, TrainingStateError } from '../../../domain/training/errors.js';
import { UNINSTALL_CHECK_MIN_MS } from '../../../domain/training/training.js';
import { postToolUseBash, postToolUseFailure, postToolUseRead, stop, userPromptSubmit } from '../../../domain/training/fixtures/hook-payloads.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingTrainingSignals } from '../../testing/fakes.js';
import { InMemoryTrainingEventRepository } from '../../testing/in-memory-training-event-repository.js';
import { InMemoryTrainingMemberRepository, InMemoryTrainingRepository } from '../../testing/in-memory-training-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { CreateTraining, StopTraining } from './admin.js';
import { IngestHookEvent } from './ingest.js';
import { FinishUninstallCheck, GetMyTraining, JoinTraining, ResumeTrainingMember, StartUninstallCheck } from './member.js';

let members: InMemoryTrainingMemberRepository;
let trainings: InMemoryTrainingRepository;
let events: InMemoryTrainingEventRepository;
let ingestSignals: RecordingTrainingSignals;
let signals: RecordingTrainingSignals;
let clock: FakeClock;

function build() {
  const unitOfWork = new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]);
  const deps = { unitOfWork, clock, signals };
  return {
    create: new CreateTraining({ ...deps, random: new FakeRandom([111111]) }),
    stop: new StopTraining(deps),
    join: new JoinTraining({ ...deps, tokens: new FakeTokenGenerator() }),
    resume: new ResumeTrainingMember({ members, trainings }),
    me: new GetMyTraining(),
    ingest: new IngestHookEvent({ members, trainings, unitOfWork, clock, signals: ingestSignals }),
    start: new StartUninstallCheck(deps),
    finish: new FinishUninstallCheck(deps),
  };
}

/** A training with one member, `Lan`; returns the member's browser token and the token their hooks carry. */
async function training() {
  const uc = build();
  const t = await uc.create.execute('T');
  const { token } = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
  const ingestToken = (await members.findByToken(token))!.ingestToken;
  return { uc, t, token, ingestToken };
}

beforeEach(() => {
  members = new InMemoryTrainingMemberRepository();
  trainings = new InMemoryTrainingRepository(members);
  events = new InMemoryTrainingEventRepository(members);
  ingestSignals = new RecordingTrainingSignals();
  signals = new RecordingTrainingSignals();
  clock = new FakeClock(1000);
});

describe('IngestHookEvent: open', () => {
  it('stores the filtered event, stamps the member (first and last seen) and signals', async () => {
    const { uc, t, token, ingestToken } = await training();
    expect(await uc.ingest.execute(ingestToken, userPromptSubmit)).toBe('stored');
    clock.advance(500);
    expect(await uc.ingest.execute(ingestToken, postToolUseBash)).toBe('stored');

    const stored = await events.all();
    expect(stored.map(e => e.kind)).toEqual(['prompt', 'tool']);
    expect(stored[1]).toMatchObject({ memberId: 1, receivedAt: new Date(1500), toolTarget: 'npm test', ok: true });
    const m = await members.findByToken(token);
    expect(m).toMatchObject({ firstSeenAt: new Date(1000), lastSeenAt: new Date(1500) });
    expect(ingestSignals.signals).toEqual([t.id, t.id]);
    expect(uc.me.execute(await uc.resume.execute(token)).member.connection).toBe('connected');
  });

  it('a failed tool call is stored as such', async () => {
    const { uc, ingestToken } = await training();
    await uc.ingest.execute(ingestToken, postToolUseFailure);
    expect((await events.all())[0]).toMatchObject({ ok: false, errorExcerpt: expect.stringContaining('Exit code 2') });
  });

  it('Read keeps no content', async () => {
    const { uc, ingestToken } = await training();
    await uc.ingest.execute(ingestToken, postToolUseRead);
    expect(JSON.stringify(await events.all())).not.toContain('sk-live');
  });

  it('an event that is not ours, or is malformed, is ignored: nothing stored, nothing stamped, no signal', async () => {
    const { uc, token, ingestToken } = await training();
    for (const raw of [stop, null, 'x', {}, undefined]) expect(await uc.ingest.execute(ingestToken, raw)).toBe('ignored');
    expect(await events.all()).toEqual([]);
    expect(await members.findByToken(token)).toMatchObject({ firstSeenAt: null, lastSeenAt: null });
    expect(ingestSignals.signals).toEqual([]);
  });

  it('an unknown or missing token is unknown, and stores nothing', async () => {
    const { uc, token } = await training();
    expect(await uc.ingest.execute('nope', userPromptSubmit)).toBe('unknown');
    expect(await uc.ingest.execute(undefined, userPromptSubmit)).toBe('unknown');
    // The member's browser token is not an ingest token.
    expect(await uc.ingest.execute(token, userPromptSubmit)).toBe('unknown');
    expect(await events.all()).toEqual([]);
  });

  it('the event and the stamp are one unit: if the stamp fails nothing is kept', async () => {
    const { uc, ingestToken } = await training();
    members.recordSeen = async () => { throw new Error('disk'); };
    await expect(uc.ingest.execute(ingestToken, userPromptSubmit)).rejects.toThrow('disk');
    expect(await events.all()).toEqual([]);
  });
});

describe('IngestHookEvent: after "Dừng thu"', () => {
  it('stores nothing, notes that the hook is still there, and tells the caller', async () => {
    const { uc, t, token, ingestToken } = await training();
    await uc.ingest.execute(ingestToken, userPromptSubmit);
    await uc.stop.execute(t.id);
    clock.advance(100);
    expect(await uc.ingest.execute(ingestToken, postToolUseBash)).toBe('stopped');
    expect(await events.all()).toHaveLength(1);
    expect(await members.findByToken(token)).toMatchObject({ seenAfterStopAt: new Date(1100), lastSeenAt: new Date(1000) });
  });

  it('events that are not ours do not count as "still sending"', async () => {
    const { uc, t, token, ingestToken } = await training();
    await uc.stop.execute(t.id);
    expect(await uc.ingest.execute(ingestToken, stop)).toBe('ignored');
    expect((await members.findByToken(token))!.seenAfterStopAt).toBeNull();
  });
});

describe('uninstall check', () => {
  async function stopped() {
    const s = await training();
    await s.uc.ingest.execute(s.ingestToken, userPromptSubmit);
    await s.uc.stop.execute(s.t.id);
    return { ...s, ctx: () => s.uc.resume.execute(s.token) };
  }

  it('quiet for 5 s → passed, the member is uninstalled and the mentor is signalled', async () => {
    const { uc, ctx, token } = await stopped();
    await uc.start.execute(await ctx());
    expect(uc.me.execute(await ctx()).member.uninstallCheck).toBe('waiting');
    clock.advance(UNINSTALL_CHECK_MIN_MS);
    signals.signals.length = 0;
    expect(await uc.finish.execute(await ctx())).toEqual({ result: 'passed' });
    expect(uc.me.execute(await ctx()).member).toMatchObject({ connection: 'uninstalled', uninstallCheck: 'passed' });
    expect((await members.findByToken(token))!.uninstalledAt).toEqual(clock.now());
    expect(signals.signals).toHaveLength(1);
  });

  it('an event after the check began → failed, nothing recorded, and a new check can follow', async () => {
    const { uc, ctx, ingestToken, token } = await stopped();
    await uc.start.execute(await ctx());
    clock.advance(1000);
    await uc.ingest.execute(ingestToken, postToolUseBash);
    clock.advance(UNINSTALL_CHECK_MIN_MS);
    expect(await uc.finish.execute(await ctx())).toEqual({ result: 'failed' });
    expect(uc.me.execute(await ctx()).member.uninstallCheck).toBe('failed');
    expect((await members.findByToken(token))!.uninstalledAt).toBeNull();

    await uc.start.execute(await ctx());
    expect(uc.me.execute(await ctx()).member.uninstallCheck).toBe('waiting');
    clock.advance(UNINSTALL_CHECK_MIN_MS);
    expect(await uc.finish.execute(await ctx())).toEqual({ result: 'passed' });
  });

  it('an event that arrives after a passed check puts the member back to still sending', async () => {
    const { uc, ctx, ingestToken } = await stopped();
    await uc.start.execute(await ctx());
    clock.advance(UNINSTALL_CHECK_MIN_MS);
    await uc.finish.execute(await ctx());
    clock.advance(10);
    await uc.ingest.execute(ingestToken, postToolUseBash);
    expect(uc.me.execute(await ctx()).member).toMatchObject({ connection: 'connected', uninstallCheck: 'failed' });
  });

  it('asking for the verdict too early is 409 too_early, and before starting it is a state error', async () => {
    const { uc, ctx } = await stopped();
    await expect(uc.finish.execute(await ctx())).rejects.toBeInstanceOf(TrainingStateError);
    await uc.start.execute(await ctx());
    clock.advance(UNINSTALL_CHECK_MIN_MS - 1);
    await expect(uc.finish.execute(await ctx())).rejects.toBeInstanceOf(TrainingCheckTooEarlyError);
    clock.advance(1);
    expect(await uc.finish.execute(await ctx())).toEqual({ result: 'passed' });
  });

  it('is refused while the training is still open', async () => {
    const { uc, token } = await training();
    await expect(uc.start.execute(await uc.resume.execute(token))).rejects.toBeInstanceOf(TrainingStateError);
    await expect(uc.finish.execute(await uc.resume.execute(token))).rejects.toBeInstanceOf(TrainingStateError);
  });
});
