import { filterHookEvent, isHookEvent } from '../../../domain/training/filter-hook-event.js';
import type { Clock } from '../../ports/clock.js';
import type { TrainingMemberReader, TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/**
 * What became of one hook call:
 * - `unknown`: the ingest token matches no member (never joined, withdrew, removed, or the training ended) → 404.
 * - `ignored`: not one of our three hooks, or malformed → nothing stored.
 * - `stored`: filtered and kept.
 * - `stopped`: the training stopped, so nothing is kept, but the hook is still installed on that machine → a reminder goes back.
 */
export type IngestResult = 'unknown' | 'ignored' | 'stored' | 'stopped';

/**
 * Takes one hook call from a member's machine. Does no network I/O and writes once (the event and the member's
 * "last seen" in one unit), because Claude Code waits for the answer on every prompt and tool call.
 * `signals` should coalesce: ingest can be very frequent.
 */
export class IngestHookEvent {
  constructor(
    private readonly deps: { members: TrainingMemberReader; trainings: TrainingReader; unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock; signals: TrainingSignals },
  ) {}

  async execute(ingestToken: string | undefined, raw: unknown): Promise<IngestResult> {
    const member = ingestToken ? await this.deps.members.findByIngestToken(ingestToken) : null;
    if (!member) return 'unknown';
    const training = await this.deps.trainings.findById(member.trainingId);
    if (!training || (training.status !== 'open' && training.status !== 'stopped')) return 'unknown';
    const now = this.deps.clock.now();

    if (training.status === 'stopped') {
      if (!isHookEvent(raw)) return 'ignored';
      await this.deps.unitOfWork.run(({ members }) => members.recordSeenAfterStop(member.id, now));
      await this.deps.signals.signal(training.id);
      return 'stopped';
    }

    const draft = filterHookEvent(raw);
    if (!draft) return 'ignored';
    await this.deps.unitOfWork.run(async ({ events, members }) => {
      await events.append({ ...draft, memberId: member.id, receivedAt: now });
      await members.recordSeen(member.id, now);
    });
    await this.deps.signals.signal(training.id);
    return 'stored';
  }
}
