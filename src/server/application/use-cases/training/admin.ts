import { TrainingEventNotFoundError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { analyzeEvents } from '../../../domain/training/flags/index.js';
import { FLAG_CODES, type FlagCode } from '../../../../shared/api/training.js';
import { isStuck, STUCK_REPEAT } from '../../../domain/training/is-stuck.js';
import { assertCanPurge, connectionState, nextTrainingStatus, stillSending, type Training, type TrainingMember } from '../../../domain/training/training.js';
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
}

export interface TrainingDetailView {
  training: Training;
  /** Only once `stopped`. */
  uninstalled: { count: number; total: number } | null;
  /** How many members have each flag: numbers only, no names (PRODUCT.md §7.35d). */
  flagCounts: Record<FlagCode, number>;
  /** Empty once `ended`: the members are gone. */
  members: TrainingMemberView[];
}

export class GetTrainingDetail {
  /** Flags are derived from a member's whole timeline, so they are kept until that member's newest event changes. */
  private readonly flagCache = new Map<number, { key: string; flags: FlagCode[] }>();

  constructor(private readonly deps: { trainings: TrainingReader; members: TrainingMemberReader; events: TrainingEventReader }) {}

  private async flagsOf(training: Training, memberId: number, counts: MemberCounts | undefined): Promise<FlagCode[]> {
    if (!counts) return [];
    const key = `${counts.lastEventId}:${training.allowAutoAccept}`;
    const cached = this.flagCache.get(memberId);
    if (cached?.key === key) return cached.flags;
    const { flags } = analyzeEvents(await this.deps.events.listForFlags(memberId), { allowAutoAccept: training.allowAutoAccept });
    const codes = flags.map(f => f.code);
    this.flagCache.set(memberId, { key, flags: codes });
    return codes;
  }

  async execute(id: number): Promise<TrainingDetailView> {
    const training = await this.deps.trainings.findById(id);
    if (!training) throw new TrainingNotFoundError();
    const members = training.status === 'ended' ? [] : await this.deps.members.listByTraining(id);
    const counts = members.length > 0 ? await this.deps.events.countsByMember(id) : new Map<number, MemberCounts>();
    const views = await Promise.all(
      members.map(async m =>
        memberView(training, m, counts.get(m.id), isStuck(await this.deps.events.recentTools(m.id, STUCK_REPEAT)), await this.flagsOf(training, m.id, counts.get(m.id))),
      ),
    );
    const flagCounts = Object.fromEntries(FLAG_CODES.map(code => [code, views.filter(v => v.flags.includes(code)).length])) as Record<FlagCode, number>;
    return {
      training,
      // A member who passed the removal check counts only while nothing came after it.
      uninstalled: training.status === 'stopped' ? { count: views.filter(v => v.connection === 'uninstalled').length, total: members.length } : null,
      flagCounts,
      members: views,
    };
  }
}

const memberView = (training: Training, m: TrainingMember, counts: MemberCounts | undefined, stuck: boolean, flags: FlagCode[]): TrainingMemberView => ({
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
