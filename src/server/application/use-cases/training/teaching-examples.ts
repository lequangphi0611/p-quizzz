import type { TeachingExampleBody, TeachingExampleRow } from '../../../../shared/api/training.js';
import { TeachingConsentMissingError, TeachingExampleNotPromptError, TeachingExamplesEmptyError, TeachingReviewNotConfirmedError, TrainingEventNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { maskSecrets } from '../../../domain/training/secrets.js';
import { buildTeachingExamplesFile, buildTurnContext } from '../../../domain/training/teaching-examples.js';
import type { Clock } from '../../ports/clock.js';
import type { TeachingExampleRecord, TrainingEventReader } from '../../ports/training-event-repository.js';
import type { TrainingMemberReader, TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { FlagEvent } from '../../../domain/training/flags/flag-event.js';

/** Once ended the members and their events are gone: a conflict, not "not found" (as the other mentor routes). */
async function openTraining(trainings: Pick<TrainingReader, 'findById'>, id: number) {
  const training = await trainings.findById(id);
  if (!training) throw new TrainingNotFoundError();
  if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
  return training;
}

const sameText = (a: string | null, b: string | null) => a === b;

/** Reads the whole timeline of each member once (bounded text only) and answers the prompt and the context of any of their prompts. */
class TimelineCache {
  private readonly byMember = new Map<number, Promise<FlagEvent[]>>();

  constructor(private readonly events: TrainingEventReader) {}

  /** The promise is cached, so parallel lookups for the same member share one read. */
  of(memberId: number): Promise<FlagEvent[]> {
    let pending = this.byMember.get(memberId);
    if (!pending) {
      pending = this.events.listForFlags(memberId);
      this.byMember.set(memberId, pending);
    }
    return pending;
  }

  /** The prompt of the event and its context, both masked: what the file holds when the mentor does not edit. */
  async defaults(memberId: number, eventId: number): Promise<{ prompt: string; context: string }> {
    const events = await this.of(memberId);
    return {
      prompt: maskSecrets(events.find(e => e.id === eventId)?.prompt ?? ''),
      context: buildTurnContext(events, eventId),
    };
  }
}

async function toRow(record: TeachingExampleRecord & { memberId: number }, memberName: string, cache: TimelineCache): Promise<TeachingExampleRow> {
  const d = await cache.defaults(record.memberId, record.eventId);
  return {
    eventId: record.eventId,
    memberId: record.memberId,
    memberName,
    label: record.label,
    topic: record.topic,
    comment: record.comment,
    betterPrompt: record.betterPrompt,
    editedPrompt: record.editedPrompt,
    editedContext: record.editedContext,
    defaultPrompt: d.prompt,
    defaultContext: d.context,
    updatedAt: record.updatedAt.getTime(),
  };
}

/**
 * The mentor makes (or changes) a prompt a teaching example (PRODUCT.md §7.39b). Only a prompt of a member who ticked the consent.
 * Saving the same content again changes nothing, not even `updated_at`.
 */
export class SaveTeachingExample {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; events: TrainingEventReader; clock: Clock }) {}

  async execute(trainingId: number, eventId: number, body: TeachingExampleBody): Promise<TeachingExampleRow> {
    const { record, member } = await this.deps.unitOfWork.run(async ({ trainings, members, events }) => {
      await openTraining(trainings, trainingId);
      const owner = await events.getEventOwner(eventId);
      if (!owner || owner.trainingId !== trainingId) throw new TrainingEventNotFoundError();
      if (owner.kind !== 'prompt') throw new TeachingExampleNotPromptError();
      const member = await members.findById(owner.memberId);
      if (!member?.teachingConsent) throw new TeachingConsentMissingError();

      const old = await events.getTeachingExample(eventId);
      const next: TeachingExampleRecord = { eventId, ...body, updatedAt: this.deps.clock.now() };
      const unchanged =
        old !== null &&
        old.label === next.label && old.topic === next.topic && old.comment === next.comment &&
        sameText(old.betterPrompt, next.betterPrompt) && sameText(old.editedPrompt, next.editedPrompt) && sameText(old.editedContext, next.editedContext);
      if (!unchanged) await events.saveTeachingExample(next);
      return { record: old !== null && unchanged ? old : next, member };
    });
    return toRow({ ...record, memberId: member.id }, member.displayName, new TimelineCache(this.deps.events));
  }
}

/** Drops the example (idempotent). An event that is not in the training is still "not found", so a wrong URL is not silently fine. */
export class DeleteTeachingExample {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext> }) {}

  async execute(trainingId: number, eventId: number): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, events }) => {
      await openTraining(trainings, trainingId);
      const owner = await events.getEventOwner(eventId);
      if (!owner || owner.trainingId !== trainingId) throw new TrainingEventNotFoundError();
      await events.deleteTeachingExample(eventId);
    });
  }
}

/** The review screen's list: every example with the prompt and the context as they would go in the file. Has member names: mentor only. */
export class ListTeachingExamples {
  constructor(private readonly deps: { trainings: TrainingReader; members: TrainingMemberReader; events: TrainingEventReader }) {}

  async execute(trainingId: number): Promise<TeachingExampleRow[]> {
    await openTraining(this.deps.trainings, trainingId);
    const [records, members] = await Promise.all([this.deps.events.listTeachingExamples(trainingId), this.deps.members.listByTraining(trainingId)]);
    const names = new Map(members.map(m => [m.id, m.displayName]));
    const cache = new TimelineCache(this.deps.events);
    return Promise.all(records.map(r => toRow(r, names.get(r.memberId) ?? '', cache)));
  }
}

/**
 * The file (PRODUCT.md §7.39d). `confirmed` is the mentor's "Tôi đã rà" tick. No member name, date, session number, output or file
 * change goes in. It does not count as exporting the report: `report_exported_at` stays as it was.
 */
export class ExportTeachingExamples {
  constructor(private readonly deps: { trainings: TrainingReader; members: TrainingMemberReader; events: TrainingEventReader; unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock; signals: TrainingSignals }) {}

  async execute(trainingId: number, options: { confirmed: boolean }): Promise<string> {
    const training = await openTraining(this.deps.trainings, trainingId);
    if (!options.confirmed) throw new TeachingReviewNotConfirmedError();
    const exportedAt = this.deps.clock.now();
    const records = await this.deps.events.listTeachingExamples(trainingId);
    if (records.length === 0) throw new TeachingExamplesEmptyError();
    const cache = new TimelineCache(this.deps.events);
    const examples = await Promise.all(
      records.map(async r => {
        const d = await cache.defaults(r.memberId, r.eventId);
        return {
          eventId: r.eventId,
          label: r.label,
          topic: r.topic,
          prompt: r.editedPrompt ?? d.prompt,
          context: r.editedContext ?? d.context,
          comment: r.comment,
          betterPrompt: r.betterPrompt,
        };
      }),
    );
    const text = buildTeachingExamplesFile(training.name, examples);
    // `exportedAt` was taken before the examples were read, so an example saved while the file was being built is newer than it and counts as not exported.
    await this.deps.unitOfWork.run(({ trainings }) => trainings.update(trainingId, { examplesExportedAt: exportedAt }));
    await this.deps.signals.signal(trainingId);
    return text;
  }
}
