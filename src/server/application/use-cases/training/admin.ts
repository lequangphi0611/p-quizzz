import { TrainingEventNotFoundError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { analyzeEvents } from '../../../domain/training/flags/index.js';
import { FLAG_CODES, type ExampleDraftCounts, type FlagCode } from '../../../../shared/api/training.js';
import { isStuck } from '../../../domain/training/is-stuck.js';
import { assertCanPurge, connectionState, nextTrainingStatus, stillSending, type Training, type TrainingMember } from '../../../domain/training/training.js';
import { countDrafts } from '../../../domain/training/example-draft.js';
import type { TeachingExampleDrafter } from '../../ports/teaching-example-drafter.js';
import type { Clock } from '../../ports/clock.js';
import type { MemberCounts, TrainingEventReader } from '../../ports/training-event-repository.js';
import type { Random } from '../../ports/random.js';
import type { TrainingListItem, TrainingMemberReader, TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { newRoomCode } from '../sessions/new-room-code.js';

interface WriteDeps {
  unitOfWork: UnitOfWork<TrainingUnitContext>;
  clock: Clock;
  signals: TrainingSignals;
}

/** Opens a training straight away (there is no draft): the mentor shows the code to the class. */
export class CreateTraining {
  constructor(private readonly deps: WriteDeps & { random: Random }) {}

  async execute(name: string, options: { allowAutoAccept?: boolean } = {}): Promise<Training> {
    const training = await this.deps.unitOfWork.run(async ({ trainings }) =>
      trainings.create({
        name,
        roomCode: await newRoomCode(this.deps.random, code => trainings.roomCodeInUse(code)),
        createdAt: this.deps.clock.now(),
        allowAutoAccept: options.allowAutoAccept ?? false,
      }),
    );
    await this.deps.signals.signal(training.id);
    return training;
  }
}

export class ListTrainings {
  constructor(private readonly trainings: TrainingReader) {}

  execute(): Promise<TrainingListItem[]> {
    return this.trainings.list();
  }
}

/** One row of the member table. */
export interface TrainingMemberView {
  id: number;
  displayName: string;
  connection: ReturnType<typeof connectionState>;
  lastSeenAt: Date | null;
  promptCount: number;
  toolCount: number;
  failedCount: number;
  stuck: boolean;
  stillSending: boolean;
  stoppedSending: boolean;
  flags: FlagCode[];
  clearCount: number;
  compactCount: number;
  permissionCount: number;
  mentorNote: string | null;
  markedCount: number;
  teachingConsent: boolean;
  exampleDrafts: ExampleDraftCounts;
}

export interface TrainingDetailView {
  training: Training;
  /** Only once `stopped`. */
  uninstalled: { count: number; total: number } | null;
  /** How many members have each flag: numbers only, no names (PRODUCT.md §7.35d). */
  flagCounts: Record<FlagCode, number>;
  /** Teaching examples never downloaded, or saved after the last download (S44): the "Kết thúc" prompt says how many. */
  unexportedExampleCount: number;
  /** S45: whether the mentor has set up the AI command, so a draft can be asked for. */
  aiDraftAvailable: boolean;
  /** S45: drafts over the whole training; `next` = the unseen finished draft that finished first. */
  exampleDrafts: ExampleDraftCounts & { next: { memberId: number; eventId: number } | null };
  /** Empty once `ended`: the members are gone. */
  members: TrainingMemberView[];
}

export class GetTrainingDetail {
  /** Flags are derived from a member's whole timeline, so they are kept until that member's newest event changes. */
  private readonly flagCache = new Map<number, { key: string; flags: FlagCode[]; stuck: boolean }>();

  constructor(private readonly deps: { trainings: TrainingReader; members: TrainingMemberReader; events: TrainingEventReader; drafter: Pick<TeachingExampleDrafter, 'available'> }) {}

  private async flagsOf(training: Training, memberId: number, counts: MemberCounts | undefined): Promise<{ flags: FlagCode[]; stuck: boolean }> {
    if (!counts) return { flags: [], stuck: false };
    const key = `${counts.lastEventId}:${training.allowAutoAccept}`;
    const cached = this.flagCache.get(memberId);
    if (cached?.key === key) return { flags: cached.flags, stuck: cached.stuck };
    const events = await this.deps.events.listForFlags(memberId);
    const { flags } = analyzeEvents(events, { allowAutoAccept: training.allowAutoAccept });
    // "Stuck" reads the same events as the flags, so it shares their cache (no separate query per poll).
    const stuck = isStuck(events.filter(e => e.kind === 'tool').map(e => ({ ok: e.ok === true, toolTarget: e.toolTarget, claudeSessionId: e.claudeSessionId })));
    const result = { flags: flags.map(f => f.code), stuck };
    this.flagCache.set(memberId, { key, ...result });
    return result;
  }

  async execute(id: number): Promise<TrainingDetailView> {
    const training = await this.deps.trainings.findById(id);
    if (!training) throw new TrainingNotFoundError();
    const members = training.status === 'ended' ? [] : await this.deps.members.listByTraining(id);
    const counts = members.length > 0 ? await this.deps.events.countsByMember(id) : new Map<number, MemberCounts>();
    const drafts = countDrafts(training.status === 'ended' ? [] : await this.deps.events.listExampleDrafts(id));
    const views = await Promise.all(
      members.map(async m => {
        const { flags, stuck } = await this.flagsOf(training, m.id, counts.get(m.id));
        return memberView(training, m, counts.get(m.id), stuck, flags, drafts.byMember.get(m.id) ?? { drafting: 0, unseen: 0, failed: 0 });
      }),
    );
    const flagCounts = Object.fromEntries(FLAG_CODES.map(code => [code, views.filter(v => v.flags.includes(code)).length])) as Record<FlagCode, number>;
    return {
      training,
      // A member who passed the removal check counts only while nothing came after it.
      uninstalled: training.status === 'stopped' ? { count: views.filter(v => v.connection === 'uninstalled').length, total: members.length } : null,
      flagCounts,
      unexportedExampleCount: training.status === 'ended' ? 0 : (await this.deps.events.listTeachingExamples(id)).filter(e => !training.examplesExportedAt || e.updatedAt > training.examplesExportedAt).length,
      aiDraftAvailable: await this.deps.drafter.available(),
      exampleDrafts: { ...drafts.total, next: drafts.next },
      members: views,
    };
  }
}

const memberView = (training: Training, m: TrainingMember, counts: MemberCounts | undefined, stuck: boolean, flags: FlagCode[], exampleDrafts: ExampleDraftCounts): TrainingMemberView => ({
  id: m.id,
  displayName: m.displayName,
  connection: connectionState(m),
  lastSeenAt: m.lastSeenAt,
  promptCount: counts?.promptCount ?? 0,
  toolCount: counts?.toolCount ?? 0,
  failedCount: counts?.failedCount ?? 0,
  stuck,
  stillSending: stillSending(training, m),
  stoppedSending: m.stoppedSendingAt !== null,
  flags,
  clearCount: counts?.clearCount ?? 0,
  compactCount: counts?.compactCount ?? 0,
  permissionCount: counts?.permissionCount ?? 0,
  mentorNote: m.mentorNote,
  markedCount: counts?.markedCount ?? 0,
  teachingConsent: m.teachingConsent,
  exampleDrafts,
});

/** "Dừng thu": the code stops working at once; reviewing stays possible. */
export class StopTraining {
  constructor(private readonly deps: WriteDeps) {}

  async execute(id: number): Promise<Training> {
    const now = this.deps.clock.now();
    const training = await this.deps.unitOfWork.run(async ({ trainings }) => {
      const current = await trainings.findById(id);
      if (!current) throw new TrainingNotFoundError();
      return trainings.update(id, { status: nextTrainingStatus(current.status, 'stop'), roomCode: null, stoppedAt: now });
    });
    await this.deps.signals.signal(id);
    return training;
  }
}

/** "Kết thúc": every member and event is deleted; only the name, the times and the member count remain. One unit. */
export class EndTraining {
  constructor(private readonly deps: WriteDeps) {}

  async execute(id: number): Promise<Training> {
    const now = this.deps.clock.now();
    const training = await this.deps.unitOfWork.run(async ({ trainings, members }) => {
      const current = await trainings.findById(id);
      if (!current) throw new TrainingNotFoundError();
      const status = nextTrainingStatus(current.status, 'end');
      const memberCount = await members.deleteByTraining(id);
      return trainings.update(id, { status, endedAt: now, memberCount });
    });
    await this.deps.signals.signal(id);
    return training;
  }
}

/** The mentor sends one member away: the member and everything collected from them is deleted. */
export class RemoveTrainingMember {
  constructor(private readonly deps: Pick<WriteDeps, 'unitOfWork' | 'signals'>) {}

  async execute(trainingId: number, memberId: number): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, members }) => {
      const training = await trainings.findById(trainingId);
      if (!training) throw new TrainingNotFoundError();
      if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc');
      const member = await members.findById(memberId);
      if (!member || member.trainingId !== trainingId) throw new TrainingMemberNotFoundError();
      await members.delete(memberId);
    });
    await this.deps.signals.signal(trainingId);
  }
}

/**
 * The mentor approves deleting what a member who pressed "Dừng gửi" had sent (PRODUCT.md §7.35j): the member and, by cascade,
 * every event of theirs go. Anyone else is refused (409): this is not a second "remove" button.
 */
export class PurgeTrainingMember {
  constructor(private readonly deps: Pick<WriteDeps, 'unitOfWork' | 'signals'>) {}

  async execute(trainingId: number, memberId: number): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, members }) => {
      const training = await trainings.findById(trainingId);
      if (!training) throw new TrainingNotFoundError();
      if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc'); // the members are gone: a conflict, not "not found"
      const member = await members.findById(memberId);
      if (!member || member.trainingId !== trainingId) throw new TrainingMemberNotFoundError();
      assertCanPurge(training, member);
      await members.delete(memberId);
    });
    await this.deps.signals.signal(trainingId);
  }
}

/** The mentor picks (or drops) an event as an example for the report. Both are idempotent. */
export class MarkTrainingEvent {
  constructor(private readonly deps: Pick<WriteDeps, 'unitOfWork'>) {}

  async execute(trainingId: number, eventId: number, marked: boolean): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, events }) => {
      const training = await trainings.findById(trainingId);
      if (!training) throw new TrainingNotFoundError();
      if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
      const detail = await events.getDetail(eventId);
      if (!detail || detail.trainingId !== trainingId) throw new TrainingEventNotFoundError();
      await events.setMark(eventId, marked);
    });
  }
}

/** The mentor's note for one member, kept for the report. An empty note clears it. */
export class SaveMemberNote {
  constructor(private readonly deps: Pick<WriteDeps, 'unitOfWork' | 'signals'>) {}

  async execute(trainingId: number, memberId: number, note: string): Promise<void> {
    await this.deps.unitOfWork.run(async ({ trainings, members }) => {
      const training = await trainings.findById(trainingId);
      if (!training) throw new TrainingNotFoundError();
      if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
      const member = await members.findById(memberId);
      if (!member || member.trainingId !== trainingId) throw new TrainingMemberNotFoundError();
      await members.setNote(memberId, note === '' ? null : note);
    });
    await this.deps.signals.signal(trainingId);
  }
}
