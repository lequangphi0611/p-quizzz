import { ExampleDraftNotFoundError, ExampleDraftUnavailableError, TeachingConsentMissingError, TeachingExampleExistsError, TeachingExampleNotPromptError, TrainingEventNotFoundError } from '../../../domain/training/errors.js';
import { earlierPromptsInSession, InvalidExampleDraftError, normalizeExampleDraft, SAMPLES_MAX_CHARS } from '../../../domain/training/example-draft.js';
import { buildTurnContext, maskForExample } from '../../../domain/training/teaching-examples.js';
import type { Clock } from '../../ports/clock.js';
import type { ExampleSampleSource } from '../../ports/example-sample-source.js';
import { ExampleDrafterError, type ExampleDraftInput, type ExampleDraftQueue, type TeachingExampleDrafter } from '../../ports/teaching-example-drafter.js';
import type { EventOwner, ExampleDraftRecord, TrainingEventReader } from '../../ports/training-event-repository.js';
import type { TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { openTraining } from './teaching-examples.js';

// AI drafts of teaching examples (PRODUCT.md §7.40, docs/architecture.md §11.12). A draft never becomes an example by itself:
// only the mentor's Save does (`SaveTeachingExample`).

export const RESTARTED_MESSAGE = 'Server đã khởi động lại';
export const CONSENT_WITHDRAWN_MESSAGE = 'Học viên đã rút lại đồng ý dùng prompt làm ví dụ';
const STORE_FAILED_MESSAGE = 'Không lưu được kết quả nháp, hãy thử lại';

interface WriteDeps {
  unitOfWork: UnitOfWork<TrainingUnitContext>;
  clock: Clock;
  signals: TrainingSignals;
}

/** The event must be one of this training: a wrong URL is "not found", not silently fine. */
async function ownedEvent(events: Pick<TrainingEventReader, 'getEventOwner'>, trainingId: number, eventId: number): Promise<EventOwner> {
  const owner = await events.getEventOwner(eventId);
  if (!owner || owner.trainingId !== trainingId) throw new TrainingEventNotFoundError();
  return owner;
}

const alive = (d: ExampleDraftRecord | null): d is ExampleDraftRecord => d !== null && (d.status === 'queued' || d.status === 'running');

/**
 * "Làm ví dụ" with the AI on: writes (or rewrites) a `queued` draft and hands it to the background queue. A draft already queued or
 * running is returned as it is, so pressing twice runs once. Only a prompt of a member who agreed, without a saved example (a judged prompt is not rewritten), only while the training is not ended.
 */
export class RequestExampleDraft {
  constructor(private readonly deps: WriteDeps & { drafter: TeachingExampleDrafter; queue: ExampleDraftQueue }) {}

  async execute(trainingId: number, eventId: number): Promise<ExampleDraftRecord> {
    const available = await this.deps.drafter.available();
    const { record, queued } = await this.deps.unitOfWork.run(async ({ trainings, members, events }) => {
      await openTraining(trainings, trainingId);
      const owner = await ownedEvent(events, trainingId, eventId);
      if (owner.kind !== 'prompt') throw new TeachingExampleNotPromptError();
      if (!(await members.findById(owner.memberId))?.teachingConsent) throw new TeachingConsentMissingError();
      if (!available) throw new ExampleDraftUnavailableError();
      if (await events.getTeachingExample(eventId)) throw new TeachingExampleExistsError();
      const existing = await events.getExampleDraft(eventId);
      if (alive(existing)) return { record: existing, queued: false };
      return { record: await events.queueExampleDraft(eventId, this.deps.clock.now()), queued: true };
    });
    if (queued) {
      this.deps.queue.enqueue([eventId]);
      await this.deps.signals.signal(trainingId);
    }
    return record;
  }
}

/** The draft of a prompt (any state), or 404 `no_draft`. */
export class GetExampleDraft {
  constructor(private readonly deps: { trainings: TrainingReader; events: TrainingEventReader }) {}

  async execute(trainingId: number, eventId: number): Promise<ExampleDraftRecord> {
    await openTraining(this.deps.trainings, trainingId);
    await ownedEvent(this.deps.events, trainingId, eventId);
    const draft = await this.deps.events.getExampleDraft(eventId);
    if (!draft) throw new ExampleDraftNotFoundError();
    return draft;
  }
}

/** "Bỏ nháp": deletes the draft, whatever its state (idempotent). A run still going finds no row and drops its result. */
export class DiscardExampleDraft {
  constructor(private readonly deps: WriteDeps) {}

  async execute(trainingId: number, eventId: number): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, events }) => {
      await openTraining(trainings, trainingId);
      await ownedEvent(events, trainingId, eventId);
      await events.deleteExampleDraft(eventId);
    });
    await this.deps.signals.signal(trainingId);
  }
}

/** The mentor opened the finished draft: the button stops saying "chưa xem". Only a finished draft can be seen (idempotent). */
export class MarkExampleDraftSeen {
  constructor(private readonly deps: WriteDeps) {}

  async execute(trainingId: number, eventId: number): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, events }) => {
      await openTraining(trainings, trainingId);
      await ownedEvent(events, trainingId, eventId);
      const draft = await events.getExampleDraft(eventId);
      if (!draft) throw new ExampleDraftNotFoundError();
      if (draft.status === 'done') await events.markExampleDraftSeen(eventId, this.deps.clock.now());
    });
    await this.deps.signals.signal(trainingId);
  }
}

/**
 * Runs one queued draft. Skips it when it is no longer `queued` (discarded, or already taken). The examples and the prompts are read
 * now, when the run starts, not when it was queued. If the row was discarded or rewritten while the AI was working, the result is dropped.
 * Never throws.
 */
export class RunExampleDraft {
  constructor(private readonly deps: WriteDeps & { events: TrainingEventReader; samples: ExampleSampleSource; drafter: TeachingExampleDrafter; onError?: (err: unknown) => void }) {}

  async execute(eventId: number): Promise<void> {
    const job = await this.deps.unitOfWork.run(async ({ events, members }) => {
      const row = await events.getExampleDraft(eventId);
      if (!row || row.status !== 'queued') return null;
      const owner = await events.getEventOwner(eventId);
      if (!owner) return null;
      // Consent is checked again here: it may have been withdrawn while the draft waited in the queue.
      if (!(await members.findById(owner.memberId))?.teachingConsent) {
        await events.failExampleDraft(eventId, CONSENT_WITHDRAWN_MESSAGE, this.deps.clock.now());
        return { skipped: true as const, trainingId: owner.trainingId };
      }
      await events.markExampleDraftRunning(eventId);
      return { skipped: false as const, trainingId: owner.trainingId, memberId: owner.memberId, createdAt: row.createdAt.getTime() };
    });
    if (!job) return;
    await this.deps.signals.signal(job.trainingId);
    if (job.skipped) return;

    let outcome: { ok: true; value: ReturnType<typeof normalizeExampleDraft>; sampleCount: number } | { ok: false; error: string };
    try {
      const timeline = await this.deps.events.listForFlags(job.memberId);
      const own = timeline.find(e => e.id === eventId && e.kind === 'prompt');
      if (!own) throw new ExampleDrafterError('process_failed', 'Không tìm thấy prompt');
      const prompt = maskForExample(own.prompt ?? '');
      const samples = await this.deps.samples.samplesFor({ trainingId: job.trainingId, excludeEventId: eventId, maxChars: SAMPLES_MAX_CHARS });
      const input: ExampleDraftInput = { prompt, earlierPrompts: earlierPromptsInSession(timeline, eventId), turnActivity: buildTurnContext(timeline, eventId), samples };
      const raw = await this.deps.drafter.draft(input);
      outcome = { ok: true, value: normalizeExampleDraft(raw, prompt), sampleCount: samples.length };
    } catch (err) {
      if (err instanceof ExampleDrafterError) outcome = { ok: false, error: err.message };
      else if (err instanceof InvalidExampleDraftError) outcome = { ok: false, error: new ExampleDrafterError('bad_output').message };
      else {
        this.deps.onError?.(err);
        outcome = { ok: false, error: 'Lỗi không xác định khi chạy AI' };
      }
    }

    const store = async (result: typeof outcome): Promise<void> => {
      await this.deps.unitOfWork.run(async ({ events }) => {
        const row = await events.getExampleDraft(eventId);
        if (!row || row.status !== 'running' || row.createdAt.getTime() !== job.createdAt) return;
        const now = this.deps.clock.now();
        if (result.ok) await events.completeExampleDraft(eventId, result.value, result.sampleCount, now);
        else await events.failExampleDraft(eventId, result.error, now);
      });
    };
    try {
      await store(outcome);
    } catch (err) {
      // Storing failed (e.g. SQLITE_BUSY): do not leave the row `running` for ever. Try once to mark it failed.
      this.deps.onError?.(err);
      try { await store({ ok: false, error: STORE_FAILED_MESSAGE }); } catch (err2) { this.deps.onError?.(err2); }
    }
    await this.deps.signals.signal(job.trainingId).catch(err => this.deps.onError?.(err));
  }
}

/** At startup: drafts left by a previous process cannot finish any more ("Viết lại nháp" runs them again). */
export class FailUnfinishedExampleDrafts {
  constructor(private readonly deps: Pick<WriteDeps, 'unitOfWork' | 'clock'>) {}

  execute(): Promise<number> {
    return this.deps.unitOfWork.run(({ events }) => events.failUnfinishedExampleDrafts(RESTARTED_MESSAGE, this.deps.clock.now()));
  }
}
