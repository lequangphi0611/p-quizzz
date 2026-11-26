import { beforeEach, describe, expect, it } from 'vitest';
import { TrainingEventNotFoundError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import type { TrainingEventDraft } from '../../../domain/training/training-event.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingTrainingSignals } from '../../testing/fakes.js';
import { FakeExampleDrafter } from '../../testing/fake-example-drafter.js';
import { InMemoryTrainingEventRepository } from '../../testing/in-memory-training-event-repository.js';
import { InMemoryTrainingMemberRepository, InMemoryTrainingRepository } from '../../testing/in-memory-training-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { CreateTraining, EndTraining, GetTrainingDetail, StopTraining } from './admin.js';
import { JoinTraining } from './member.js';
import { EVENTS_PAGE_SIZE, GetTrainingEventDetail, ListMemberEvents } from './view.js';

let members: InMemoryTrainingMemberRepository;
let trainings: InMemoryTrainingRepository;
let events: InMemoryTrainingEventRepository;
let clock: FakeClock;

function build(randoms = [111111, 222222]) {
  const unitOfWork = new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]);
  const deps = { unitOfWork, clock, signals: new RecordingTrainingSignals() };
  return {
    create: new CreateTraining({ ...deps, random: new FakeRandom(randoms) }),
    join: new JoinTraining({ ...deps, tokens: new FakeTokenGenerator() }),
    stop: new StopTraining(deps),
    end: new EndTraining(deps),
    detail: new GetTrainingDetail({ trainings, members, events, drafter: new FakeExampleDrafter() }),
    timeline: new ListMemberEvents({ trainings, members, events }),
    eventDetail: new GetTrainingEventDetail({ trainings, events }),
  };
}

const prompt = (text = 'hỏi gì đó'): TrainingEventDraft => ({ kind: 'prompt', claudeSessionId: 's1', permissionMode: null, promptId: null, prompt: text });
const tool = (o: Partial<Extract<TrainingEventDraft, { kind: 'tool' }>> = {}): TrainingEventDraft => ({
  kind: 'tool', claudeSessionId: 's1', permissionMode: null, promptId: null, note: null, toolName: 'Bash', ok: true, durationMs: 10, toolTarget: 'npm test', errorExcerpt: null, output: null, change: null, ...o,
});
const add = (memberId: number, draft: TrainingEventDraft) => events.append({ ...draft, memberId, receivedAt: clock.now() });

async function scene() {
  const uc = build();
  const t = await uc.create.execute('T');
  const lan = (await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' })).member;
  const mai = (await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111' })).member;
  return { uc, t, lan, mai };
}

beforeEach(() => {
  members = new InMemoryTrainingMemberRepository();
  trainings = new InMemoryTrainingRepository(members);
  events = new InMemoryTrainingEventRepository(members);
  clock = new FakeClock(1000);
});

describe('GetTrainingDetail: counts and the stuck flag', () => {
  it('counts prompts, tool calls and failed calls per member, and leaves members with no events at zero', async () => {
    const { uc, t, lan, mai } = await scene();
    await add(lan.id, prompt());
    await add(lan.id, tool());
    await add(lan.id, tool({ ok: false, toolTarget: 'x' }));
    await add(lan.id, prompt());
    const d = await uc.detail.execute(t.id);
    expect(d.members.find(m => m.id === lan.id)).toMatchObject({ promptCount: 2, toolCount: 2, failedCount: 1, stuck: false });
    expect(d.members.find(m => m.id === mai.id)).toMatchObject({ promptCount: 0, toolCount: 0, failedCount: 0, stuck: false });
  });

  it('stuck: 3 failures in a row on one command; a success in between clears it; a prompt in between does not', async () => {
    const { uc, t, lan, mai } = await scene();
    const stuck = (id: number) => uc.detail.execute(t.id).then(d => d.members.find(m => m.id === id)!.stuck);
    const fail = () => tool({ ok: false, toolTarget: 'npm test' });
    await add(lan.id, fail());
    await add(lan.id, prompt());
    await add(lan.id, fail());
    await add(lan.id, prompt());
    expect(await stuck(lan.id)).toBe(false);
    await add(lan.id, fail());
    expect(await stuck(lan.id)).toBe(true);
    await add(lan.id, tool({ toolTarget: 'npm test' }));
    expect(await stuck(lan.id)).toBe(false);

    for (const target of ['a', 'b', 'c']) await add(mai.id, tool({ ok: false, toolTarget: target }));
    expect(await stuck(mai.id)).toBe(false); // three failures, three different commands
  });

  it('counts only that training\'s members, and the removal count follows the connection state', async () => {
    const { uc, t, lan } = await scene();
    const other = build([333333]);
    const t2 = await other.create.execute('Other');
    await add(lan.id, prompt());
    expect((await other.detail.execute(t2.id)).members).toEqual([]);
    await uc.stop.execute(t.id);
    expect((await uc.detail.execute(t.id)).uninstalled).toEqual({ count: 0, total: 2 });
    await members.finishUninstall(lan.id, clock.now());
    expect((await uc.detail.execute(t.id)).uninstalled).toEqual({ count: 1, total: 2 });
  });

  it('an ended training has no members and no counts', async () => {
    const { uc, t, lan } = await scene();
    await add(lan.id, prompt());
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    expect((await uc.detail.execute(t.id)).members).toEqual([]);
  });
});

describe('ListMemberEvents', () => {
  it('lists in the order received and builds the summary of each call', async () => {
    const { uc, t, lan } = await scene();
    await add(lan.id, prompt('Viết hàm'));
    await add(lan.id, tool({ output: { head: 'PASS\nTests: 3 passed\n', tail: null, omittedLines: 0 } }));
    await add(lan.id, tool({ ok: false, toolTarget: 'ls /x', errorExcerpt: 'Exit code 2\nls: nope', durationMs: null }));
    await add(lan.id, tool({ toolName: 'Write', toolTarget: 'a.ts', change: { head: 'x', tail: null, omittedLines: 0 } }));
    const page = await uc.timeline.execute(t.id, lan.id);
    expect(page.hasMore).toBe(false);
    expect(page.events.map(e => [e.kind, e.summary, e.hasOutput, e.hasChange])).toEqual([
      ['prompt', null, false, false],
      ['tool', 'Tests: 3 passed', true, false],
      ['tool', 'Exit code 2\nls: nope', false, false],
      ['tool', null, false, true],
    ]);
    expect(page.events[0]).toMatchObject({ prompt: 'Viết hàm', toolName: null });
    expect(page.events[1]).toMatchObject({ toolName: 'Bash', toolTarget: 'npm test', ok: true, durationMs: 10, prompt: null });
    const ids = page.events.map(e => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('pages with `after`, 500 at a time, and says whether more follow', async () => {
    const { uc, t, lan } = await scene();
    for (let i = 0; i < EVENTS_PAGE_SIZE + 5; i++) await add(lan.id, prompt(`p${i}`));
    const first = await uc.timeline.execute(t.id, lan.id);
    expect(first.events).toHaveLength(EVENTS_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    const second = await uc.timeline.execute(t.id, lan.id, first.events.at(-1)!.id);
    expect(second.events.map(e => e.prompt)).toEqual(['p500', 'p501', 'p502', 'p503', 'p504']);
    expect(second.hasMore).toBe(false);
    expect((await uc.timeline.execute(t.id, lan.id, second.events.at(-1)!.id)).events).toEqual([]);
  });

  it('exactly one full page has no more', async () => {
    const { uc, t, lan } = await scene();
    for (let i = 0; i < EVENTS_PAGE_SIZE; i++) await add(lan.id, prompt());
    expect((await uc.timeline.execute(t.id, lan.id)).hasMore).toBe(false);
  });

  it('only that member\'s events; another training\'s member is not found; an ended training is a conflict', async () => {
    const { uc, t, lan, mai } = await scene();
    await add(lan.id, prompt('của Lan'));
    await add(mai.id, prompt('của Mai'));
    expect((await uc.timeline.execute(t.id, lan.id)).events.map(e => e.prompt)).toEqual(['của Lan']);

    const other = build([333333]);
    const t2 = await other.create.execute('Other');
    await expect(uc.timeline.execute(t2.id, lan.id)).rejects.toBeInstanceOf(TrainingMemberNotFoundError);
    await expect(uc.timeline.execute(t.id, 99)).rejects.toBeInstanceOf(TrainingMemberNotFoundError);
    await expect(uc.timeline.execute(99, lan.id)).rejects.toBeInstanceOf(TrainingNotFoundError);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    await expect(uc.timeline.execute(t.id, lan.id)).rejects.toBeInstanceOf(TrainingStateError);
  });
});

describe('GetTrainingEventDetail', () => {
  it('returns the clip of the output and of the change', async () => {
    const { uc, t, lan } = await scene();
    const output = { head: 'a', tail: 'z', omittedLines: 9 };
    const change = { head: '- x\n+ y', tail: null, omittedLines: 0 };
    await add(lan.id, tool({ output, change }));
    await add(lan.id, prompt());
    expect(await uc.eventDetail.execute(t.id, 1)).toEqual({ output, change });
    expect(await uc.eventDetail.execute(t.id, 2)).toEqual({ output: null, change: null });
  });

  it('an unknown event, or an event of another training, is not found; an ended training is a conflict', async () => {
    const { uc, t, lan } = await scene();
    await add(lan.id, tool({ output: { head: 'a', tail: null, omittedLines: 0 } }));
    await expect(uc.eventDetail.execute(t.id, 99)).rejects.toBeInstanceOf(TrainingEventNotFoundError);
    const other = build([333333]);
    const t2 = await other.create.execute('Other');
    await expect(uc.eventDetail.execute(t2.id, 1)).rejects.toBeInstanceOf(TrainingEventNotFoundError);
    await expect(uc.eventDetail.execute(99, 1)).rejects.toBeInstanceOf(TrainingNotFoundError);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    await expect(uc.eventDetail.execute(t.id, 1)).rejects.toBeInstanceOf(TrainingStateError);
  });
});
