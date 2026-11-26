import { beforeEach, describe, expect, it } from 'vitest';
import type { TeachingExampleBody } from '../../../../shared/api/training.js';
import { ExampleDraftNotFoundError, ExampleDraftUnavailableError, TeachingConsentMissingError, TeachingExampleNotPromptError, TrainingEventNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import type { TrainingEventDraft } from '../../../domain/training/training-event.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingTrainingSignals } from '../../testing/fakes.js';
import { FakeExampleDrafter } from '../../testing/fake-example-drafter.js';
import { InMemoryTrainingEventRepository } from '../../testing/in-memory-training-event-repository.js';
import { InMemoryTrainingMemberRepository, InMemoryTrainingRepository } from '../../testing/in-memory-training-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import type { ExampleSampleSource } from '../../ports/example-sample-source.js';
import { ExampleDrafterError, type ExampleDraftQueue } from '../../ports/teaching-example-drafter.js';
import { CreateTraining, EndTraining, GetTrainingDetail, StopTraining } from './admin.js';
import { CurrentTrainingSampleSource } from './current-training-sample-source.js';
import { CONSENT_WITHDRAWN_MESSAGE, DiscardExampleDraft, FailUnfinishedExampleDrafts, GetExampleDraft, MarkExampleDraftSeen, RequestExampleDraft, RunExampleDraft } from './example-drafts.js';
import { JoinTraining } from './member.js';
import { SaveTeachingExample } from './teaching-examples.js';
import { ListMemberEvents } from './view.js';

let members: InMemoryTrainingMemberRepository;
let trainings: InMemoryTrainingRepository;
let events: InMemoryTrainingEventRepository;
let signals: RecordingTrainingSignals;
let clock: FakeClock;
let drafter: FakeExampleDrafter;
let queue: ExampleDraftQueue & { ids: number[] };
let sampleCalls: { trainingId: number; excludeEventId: number; maxChars: number }[];
let samples: Awaited<ReturnType<ExampleSampleSource['samplesFor']>>;

function build() {
  const unitOfWork = new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]);
  const deps = { unitOfWork, clock, signals };
  const sampleSource: ExampleSampleSource = { samplesFor: async input => (sampleCalls.push(input), samples) };
  return {
    create: new CreateTraining({ ...deps, random: new FakeRandom([111111]) }),
    join: new JoinTraining({ ...deps, tokens: new FakeTokenGenerator() }),
    stop: new StopTraining(deps),
    end: new EndTraining(deps),
    request: new RequestExampleDraft({ ...deps, drafter, queue }),
    get: new GetExampleDraft({ trainings, events }),
    discard: new DiscardExampleDraft(deps),
    seen: new MarkExampleDraftSeen(deps),
    run: new RunExampleDraft({ ...deps, events, samples: sampleSource, drafter }),
    failUnfinished: new FailUnfinishedExampleDrafts(deps),
    save: new SaveTeachingExample({ unitOfWork, events, clock }),
    detail: new GetTrainingDetail({ trainings, members, events, drafter }),
    timeline: new ListMemberEvents({ trainings, members, events }),
  };
}

const prompt = (text: string, session = 's1'): TrainingEventDraft => ({ kind: 'prompt', claudeSessionId: session, permissionMode: null, promptId: null, prompt: text });
const tool = (target: string, ok = true, session = 's1'): TrainingEventDraft => ({
  kind: 'tool', claudeSessionId: session, permissionMode: null, promptId: null, note: null, toolName: 'Bash', ok, durationMs: 10, toolTarget: target, errorExcerpt: null, output: null, change: null,
});
const add = async (memberId: number, draft: TrainingEventDraft) => {
  await events.append({ ...draft, memberId, receivedAt: clock.now() });
  return (await events.all()).at(-1)!.id;
};
const BODY: TeachingExampleBody = { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: null, editedPrompt: null, editedContext: null };

async function scene(consent = true) {
  const uc = build();
  const t = await uc.create.execute('Buổi 1');
  const lan = (await uc.join.execute({ trainingId: t.id, displayName: 'Nguyễn Văn Lan', roomCode: '111111', teachingConsent: consent })).member;
  const e1 = await add(lan.id, prompt('Đọc file auth.ts'));
  const e2 = await add(lan.id, prompt('Sửa lỗi đăng nhập'));
  await add(lan.id, tool('npm test'));
  return { uc, t, lan, e1, e2 };
}

beforeEach(() => {
  members = new InMemoryTrainingMemberRepository();
  trainings = new InMemoryTrainingRepository(members);
  events = new InMemoryTrainingEventRepository(members);
  signals = new RecordingTrainingSignals();
  clock = new FakeClock(1000);
  drafter = new FakeExampleDrafter();
  queue = { ids: [], enqueue(ids) { this.ids.push(...ids); } };
  sampleCalls = [];
  samples = [];
});

describe('RequestExampleDraft', () => {
  it('queues a draft, hands it to the background queue and signals', async () => {
    const { uc, t, e2 } = await scene();
    const row = await uc.request.execute(t.id, e2);
    expect(row).toMatchObject({ eventId: e2, status: 'queued', seenAt: null, createdAt: new Date(1000) });
    expect(queue.ids).toEqual([e2]);
    expect(signals.signals).toContain(t.id);
    expect(drafter.inputs).toEqual([]); // nothing runs in the request
  });

  it('does not queue a second run while one is queued or running, and returns the current state', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    clock.advance(5);
    expect(await uc.request.execute(t.id, e2)).toMatchObject({ status: 'queued', createdAt: new Date(1000) });
    await events.markExampleDraftRunning(e2);
    expect((await uc.request.execute(t.id, e2)).status).toBe('running');
    expect(queue.ids).toEqual([e2]);
  });

  it('rewrites a finished or failed draft: fresh state, not seen, queued again', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2);
    await uc.seen.execute(t.id, e2);
    expect((await events.getExampleDraft(e2))!.seenAt).not.toBeNull();
    clock.advance(10);
    const again = await uc.request.execute(t.id, e2);
    expect(again).toMatchObject({ status: 'queued', label: null, comment: null, seenAt: null, finishedAt: null, createdAt: new Date(1010) });
    expect(queue.ids).toEqual([e2, e2]);
  });

  it('refuses: an event that is not a prompt, an unknown event or training, no AI, an ended training', async () => {
    const { uc, t, e2 } = await scene();
    const toolId = (await events.all()).find(e => e.kind === 'tool')!.id;
    await expect(uc.request.execute(t.id, toolId)).rejects.toBeInstanceOf(TeachingExampleNotPromptError);
    await expect(uc.request.execute(t.id, 999)).rejects.toBeInstanceOf(TrainingEventNotFoundError);
    await expect(uc.request.execute(t.id + 1, e2)).rejects.toBeInstanceOf(TrainingNotFoundError); // no such training

    drafter.isAvailable = false;
    await expect(uc.request.execute(t.id, e2)).rejects.toBeInstanceOf(ExampleDraftUnavailableError);
    drafter.isAvailable = true;
    expect(queue.ids).toEqual([]);

    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    await expect(uc.request.execute(t.id, e2)).rejects.toBeInstanceOf(TrainingStateError);
  });

  it('refuses a member who did not agree to teaching examples', async () => {
    const { uc, t, e2 } = await scene(false);
    await expect(uc.request.execute(t.id, e2)).rejects.toBeInstanceOf(TeachingConsentMissingError);
    expect(await events.getExampleDraft(e2)).toBeNull();
  });
});

describe('RunExampleDraft', () => {
  it('runs a queued draft: reads the samples now, sends the masked prompt, the earlier prompt of the session and the turn activity, and stores the result', async () => {
    const { uc, t, e2 } = await scene();
    await add(1, prompt('prompt của phiên khác', 's2')); // another session: not an earlier prompt
    samples = [{ prompt: 'mẫu', turnActivity: '✓ Bash ls', label: 'good', topic: 'verify', comment: 'tốt', betterPrompt: null }];
    await uc.request.execute(t.id, e2);
    clock.advance(30);
    await uc.run.execute(e2);

    expect(sampleCalls).toEqual([{ trainingId: t.id, excludeEventId: e2, maxChars: 40_000 }]);
    expect(drafter.inputs).toEqual([{ prompt: 'Sửa lỗi đăng nhập', earlierPrompts: ['Đọc file auth.ts'], turnActivity: '✓ Bash npm test', samples }]);
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'done', label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn', sampleCount: 1, error: null, finishedAt: new Date(1030) });
  });

  it('sends nothing that names the member, the training or a time', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2);
    const sent = JSON.stringify(drafter.inputs);
    for (const leaked of ['Nguyễn Văn Lan', 'Lan', 'Buổi 1', '1970', 'T00:00']) expect(sent).not.toContain(leaked);
  });

  it('masks secrets and home folders in the prompt', async () => {
    const { uc, t, lan } = await scene();
    const id = await add(lan.id, prompt('đọc /home/lan/bai.ts với khoá sk-live-abcdefghijklmnop1234'));
    await uc.request.execute(t.id, id);
    await uc.run.execute(id);
    expect(drafter.inputs[0]!.prompt).not.toContain('/home/lan');
    expect(drafter.inputs[0]!.prompt).not.toContain('sk-live-abcdefghijklmnop1234');
  });

  it('fails with the short Vietnamese reason of the error, and "bad output" for an unusable answer', async () => {
    const { uc, t, e2, e1 } = await scene();
    drafter.answer = new ExampleDrafterError('timeout');
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2);
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'failed', error: 'Quá thời gian', finishedAt: new Date(1000) });

    drafter.answer = { label: 'great', topic: 'verify', comment: 'x', betterPrompt: '', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: null };
    await uc.request.execute(t.id, e1);
    await uc.run.execute(e1);
    expect(await events.getExampleDraft(e1)).toMatchObject({ status: 'failed', error: 'AI trả kết quả không hợp lệ' });
  });

  it('fails an unexpected error with a generic message and reports it, never its text', async () => {
    const { uc, t, e2 } = await scene();
    drafter.answer = new Error('secret config path /home/x/ai.json');
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2);
    expect((await events.getExampleDraft(e2))!.error).toBe('Lỗi không xác định khi chạy AI');
  });

  it('skips a draft that is not queued any more (discarded or already taken) without calling the AI', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    await uc.discard.execute(t.id, e2);
    await uc.run.execute(e2);
    await uc.run.execute(12345);
    expect(drafter.inputs).toEqual([]);
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2);
    await uc.run.execute(e2); // second time: already done
    expect(drafter.inputs).toHaveLength(1);
  });

  it('fails a queued draft without calling the AI when the member withdrew consent while it waited', async () => {
    const { uc, t, lan, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    (await members.findById(lan.id))!.teachingConsent = false;
    await uc.run.execute(e2);
    expect(drafter.inputs).toEqual([]);
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'failed', error: CONSENT_WITHDRAWN_MESSAGE });
  });

  it('does not leave the draft running when storing the result fails: reports it and marks the draft failed', async () => {
    const { uc, t, e2 } = await scene();
    const errors: unknown[] = [];
    const run = new RunExampleDraft({ unitOfWork: new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]), clock, signals, events, samples: { samplesFor: async () => samples }, drafter, onError: e => errors.push(e) });
    await uc.request.execute(t.id, e2);
    const complete = events.completeExampleDraft.bind(events);
    events.completeExampleDraft = async () => { events.completeExampleDraft = complete; throw new Error('SQLITE_BUSY'); };
    await run.execute(e2);
    expect(errors).toHaveLength(1);
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'failed' });
  });

  it('drops the result of a draft discarded or rewritten while the AI was working', async () => {
    const { uc, t, e2 } = await scene();
    let release!: () => void;
    drafter.answer = () => new Promise(resolve => { release = () => resolve({ label: 'good', topic: 'other', comment: 'muộn', betterPrompt: '', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: null }); });
    await uc.request.execute(t.id, e2);
    const running = uc.run.execute(e2);
    await new Promise(r => setTimeout(r, 0));
    expect((await events.getExampleDraft(e2))!.status).toBe('running');
    await uc.discard.execute(t.id, e2);
    release();
    await running;
    expect(await events.getExampleDraft(e2)).toBeNull();

    // rewritten meanwhile: the new row is queued, the old result must not fill it
    await uc.request.execute(t.id, e2);
    const again = uc.run.execute(e2);
    await new Promise(r => setTimeout(r, 0));
    await uc.discard.execute(t.id, e2);
    clock.advance(10);
    await uc.request.execute(t.id, e2);
    await events.markExampleDraftRunning(e2);
    release();
    await again;
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'running', comment: null });
  });
});

describe('GetExampleDraft / DiscardExampleDraft / MarkExampleDraftSeen', () => {
  it('404 no_draft without a draft; discarding is idempotent; an event of another training is not found', async () => {
    const { uc, t, e2 } = await scene();
    await expect(uc.get.execute(t.id, e2)).rejects.toBeInstanceOf(ExampleDraftNotFoundError);
    await uc.request.execute(t.id, e2);
    expect((await uc.get.execute(t.id, e2)).status).toBe('queued');
    await uc.discard.execute(t.id, e2);
    await uc.discard.execute(t.id, e2);
    await expect(uc.get.execute(t.id, e2)).rejects.toBeInstanceOf(ExampleDraftNotFoundError);
    await expect(uc.discard.execute(t.id, 999)).rejects.toBeInstanceOf(TrainingEventNotFoundError);
  });

  it('seen is set once, only for a finished draft', async () => {
    const { uc, t, e2 } = await scene();
    await expect(uc.seen.execute(t.id, e2)).rejects.toBeInstanceOf(ExampleDraftNotFoundError);
    await uc.request.execute(t.id, e2);
    await uc.seen.execute(t.id, e2); // still queued: nothing to have seen
    expect((await events.getExampleDraft(e2))!.seenAt).toBeNull();
    await uc.run.execute(e2);
    clock.advance(5);
    await uc.seen.execute(t.id, e2);
    clock.advance(5);
    await uc.seen.execute(t.id, e2);
    expect((await events.getExampleDraft(e2))!.seenAt).toEqual(new Date(1005));
  });

  it('ending the training deletes the drafts with everything else', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    expect(await events.listExampleDrafts(t.id)).toEqual([]);
  });
});

describe('FailUnfinishedExampleDrafts', () => {
  it('turns queued and running drafts into failed "Server đã khởi động lại", and leaves finished ones; asking again runs it', async () => {
    const { uc, t, e1, e2 } = await scene();
    await uc.request.execute(t.id, e1);
    await uc.run.execute(e1); // done
    await uc.request.execute(t.id, e2);
    await events.markExampleDraftRunning(e2);
    expect(await uc.failUnfinished.execute()).toBe(1);
    expect(await events.getExampleDraft(e2)).toMatchObject({ status: 'failed', error: 'Server đã khởi động lại' });
    expect((await events.getExampleDraft(e1))!.status).toBe('done');
    await uc.request.execute(t.id, e2); // "Viết lại nháp"
    await uc.run.execute(e2);
    expect((await events.getExampleDraft(e2))!.status).toBe('done');
  });
});

describe('SaveTeachingExample with a draft (S45)', () => {
  const finished = async (uc: ReturnType<typeof build>, trainingId: number, eventId: number) => {
    await uc.request.execute(trainingId, eventId);
    await uc.run.execute(eventId);
  };

  it('kept as written: origin ai_kept, the draft is copied into the example and the draft row is deleted', async () => {
    const { uc, t, e2 } = await scene();
    await finished(uc, t.id, e2);
    const draft = (await events.getExampleDraft(e2))!;
    await uc.save.execute(t.id, e2, { ...BODY, comment: `  ${draft.comment}  `, betterPrompt: draft.betterPrompt });
    expect(await events.getExampleDraft(e2)).toBeNull();
    expect(await events.getTeachingExample(e2)).toMatchObject({ origin: 'ai_kept', aiDraft: { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn' } });
  });

  it('changed by the mentor: origin ai_edited with the draft as the AI wrote it', async () => {
    const { uc, t, e2 } = await scene();
    await finished(uc, t.id, e2);
    await uc.save.execute(t.id, e2, { ...BODY, label: 'good', comment: 'Mentor viết lại' });
    expect(await events.getTeachingExample(e2)).toMatchObject({ origin: 'ai_edited', label: 'good', aiDraft: { label: 'needs_work', comment: 'Chưa nói cách kiểm tra' } });
  });

  it('no draft: origin mentor, no ai_draft', async () => {
    const { uc, t, e2 } = await scene();
    await uc.save.execute(t.id, e2, BODY);
    expect(await events.getTeachingExample(e2)).toMatchObject({ origin: 'mentor', aiDraft: null });
  });

  it('a draft still being written when the mentor saves is cancelled and the example is the mentor’s own', async () => {
    const { uc, t, e2 } = await scene();
    await uc.request.execute(t.id, e2);
    await uc.save.execute(t.id, e2, BODY);
    expect(await events.getExampleDraft(e2)).toBeNull();
    expect(await events.getTeachingExample(e2)).toMatchObject({ origin: 'mentor', aiDraft: null });
    await uc.run.execute(e2); // the queue still holds the id: it finds nothing to do
    expect(drafter.inputs).toEqual([]);
  });

  it('saving again from the review screen keeps the ai_draft and recomputes the origin: an edit turns ai_kept into ai_edited', async () => {
    const { uc, t, e2 } = await scene();
    await finished(uc, t.id, e2);
    const draft = (await events.getExampleDraft(e2))!;
    await uc.save.execute(t.id, e2, { ...BODY, comment: draft.comment!, betterPrompt: draft.betterPrompt });
    expect((await events.getTeachingExample(e2))!.origin).toBe('ai_kept');
    await uc.save.execute(t.id, e2, { ...BODY, comment: 'Sửa ở màn rà', betterPrompt: draft.betterPrompt });
    expect(await events.getTeachingExample(e2)).toMatchObject({ origin: 'ai_edited', aiDraft: { comment: 'Chưa nói cách kiểm tra' } });
  });

  it('changing only the origin touches neither reviewed_at nor updated_at', async () => {
    const { uc, t, e2 } = await scene();
    const first = await uc.save.execute(t.id, e2, BODY); // the mentor's own
    await events.setTeachingReviewed(e2, new Date(1500));
    clock.advance(1000);
    // A finished draft that is the same as the saved content: same content, so only the origin changes (mentor → ai_kept).
    await finished(uc, t.id, e2);
    await uc.save.execute(t.id, e2, { ...BODY, comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn' }); // new content (better prompt): saved normally
    const saved = (await events.getTeachingExample(e2))!;
    expect(saved.updatedAt.getTime()).toBeGreaterThan(first.updatedAt);

    // Now the same content again, with a rewritten draft that differs: content unchanged, origin changes.
    await events.setTeachingReviewed(e2, new Date(1700));
    clock.advance(1000);
    drafter.answer = { label: 'good', topic: 'other', comment: 'Khác hẳn', betterPrompt: '', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: null };
    await finished(uc, t.id, e2);
    await uc.save.execute(t.id, e2, { ...BODY, comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn' });
    const after = (await events.getTeachingExample(e2))!;
    expect(after).toMatchObject({ origin: 'ai_edited', aiDraft: { comment: 'Khác hẳn' } });
    expect(after.updatedAt).toEqual(saved.updatedAt);
    expect(after.reviewedAt).toEqual(new Date(1700));
  });

  it('the example row of the review screen does not show where it came from', async () => {
    const { uc, t, e2 } = await scene();
    await finished(uc, t.id, e2);
    const row = await uc.save.execute(t.id, e2, BODY);
    expect(Object.keys(row)).not.toContain('origin');
    expect(JSON.stringify(row)).not.toContain('aiDraft');
  });
});

describe('the counts and the example button (S45)', () => {
  it('count drafts per member and for the training, with the unseen draft that finished first as next; the timeline row carries the state', async () => {
    const { uc, t, lan, e1, e2 } = await scene();
    const mai = (await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111', teachingConsent: true })).member;
    const m1 = await add(mai.id, prompt('Mai hỏi'));
    await uc.request.execute(t.id, e2);
    await uc.run.execute(e2); // done at 1000
    clock.advance(50);
    await uc.request.execute(t.id, m1);
    await uc.run.execute(m1); // done at 1050
    clock.advance(50);
    drafter.answer = new ExampleDrafterError('too_long');
    await uc.request.execute(t.id, e1);
    await uc.run.execute(e1); // failed
    await add(mai.id, prompt('Mai hỏi nữa'));
    const m2 = (await events.all()).at(-1)!.id;
    await uc.request.execute(t.id, m2); // queued

    const d = await uc.detail.execute(t.id);
    expect(d.aiDraftAvailable).toBe(true);
    expect(d.exampleDrafts).toEqual({ drafting: 1, unseen: 2, failed: 1, next: { memberId: lan.id, eventId: e2 } });
    expect(d.members.find(m => m.id === lan.id)!.exampleDrafts).toEqual({ drafting: 0, unseen: 1, failed: 1 });
    expect(d.members.find(m => m.id === mai.id)!.exampleDrafts).toEqual({ drafting: 1, unseen: 1, failed: 0 });

    await uc.seen.execute(t.id, e2);
    expect((await uc.detail.execute(t.id)).exampleDrafts).toMatchObject({ unseen: 1, next: { memberId: mai.id, eventId: m1 } });

    const rows = (await uc.timeline.execute(t.id, lan.id)).events;
    expect(rows.find(r => r.id === e2)!.exampleDraft).toEqual({ status: 'done', seen: true, suspicious: false, error: null });
    expect(rows.find(r => r.id === e1)!.exampleDraft).toEqual({ status: 'failed', seen: false, suspicious: false, error: 'Prompt quá dài để AI đọc' });
    expect(rows.find(r => r.kind === 'tool')!.exampleDraft).toBeNull();
  });

  it('says the AI is not available when the drafter is off, and has no drafts to count when the training has ended', async () => {
    const { uc, t, e2 } = await scene();
    drafter.isAvailable = false;
    expect((await uc.detail.execute(t.id)).aiDraftAvailable).toBe(false);
    drafter.isAvailable = true;
    await uc.request.execute(t.id, e2);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    expect((await uc.detail.execute(t.id)).exampleDrafts).toEqual({ drafting: 0, unseen: 0, failed: 0, next: null });
  });
});

describe('CurrentTrainingSampleSource', () => {
  it('takes the examples of this training, newest first, not the one being drafted nor the kept ones, with the reviewed text when there is one', async () => {
    const { uc, t, lan, e1, e2 } = await scene();
    const e3 = await add(lan.id, prompt('prompt ba'));
    const e4 = await add(lan.id, prompt('prompt bốn'));
    await uc.save.execute(t.id, e1, { ...BODY, comment: 'một', editedPrompt: 'prompt một đã sửa' });
    clock.advance(10);
    await uc.save.execute(t.id, e3, { ...BODY, comment: 'ba' });
    clock.advance(10);
    // e4 is kept as the AI wrote it: it must not teach the AI its own words
    await uc.request.execute(t.id, e4);
    await uc.run.execute(e4);
    const d = (await events.getExampleDraft(e4))!;
    await uc.save.execute(t.id, e4, { ...BODY, comment: d.comment!, betterPrompt: d.betterPrompt });
    clock.advance(10);
    await uc.save.execute(t.id, e2, { ...BODY, comment: 'hai' });

    const source = new CurrentTrainingSampleSource({ events });
    const picked = await source.samplesFor({ trainingId: t.id, excludeEventId: e2, maxChars: 40_000 });
    expect(picked.map(s => s.comment)).toEqual(['ba', 'một']);
    expect(picked.map(s => s.prompt)).toEqual(['prompt ba', 'prompt một đã sửa']);
    expect(picked[1]!.turnActivity).toBe('');
    expect(await source.samplesFor({ trainingId: t.id + 1, excludeEventId: 0, maxChars: 40_000 })).toEqual([]);
  });
});
