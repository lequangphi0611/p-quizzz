import { TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { analyzeEvents } from '../../../domain/training/flags/index.js';
import { buildReport, type ReportMember } from '../../../domain/training/report.js';
import type { Clock } from '../../ports/clock.js';
import type { TrainingEventReader } from '../../ports/training-event-repository.js';
import type { TrainingMemberReader, TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/**
 * The report the mentor downloads before "Kết thúc" (PRODUCT.md §7.35e). Members who agreed and were not deleted are in it, named;
 * one who pressed "Dừng gửi" and was not purged yet is in it too, marked so. `preview` builds the same text without counting as an export.
 */
export class ExportTrainingReport {
  constructor(
    private readonly deps: {
      trainings: TrainingReader;
      members: TrainingMemberReader;
      events: TrainingEventReader;
      unitOfWork: UnitOfWork<TrainingUnitContext>;
      clock: Clock;
      signals: TrainingSignals;
    },
  ) {}

  async execute(trainingId: number, options: { preview?: boolean } = {}): Promise<string> {
    const training = await this.deps.trainings.findById(trainingId);
    if (!training) throw new TrainingNotFoundError();
    if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
    const now = this.deps.clock.now();

    const [members, counts, marked] = await Promise.all([
      this.deps.members.listByTraining(trainingId),
      this.deps.events.countsByMember(trainingId),
      this.deps.events.listMarked(trainingId),
    ]);
    const rows: ReportMember[] = [];
    for (const m of members) {
      const c = counts.get(m.id);
      const { flags } = c ? analyzeEvents(await this.deps.events.listForFlags(m.id), { allowAutoAccept: training.allowAutoAccept }) : { flags: [] };
      rows.push({
        displayName: m.displayName,
        stoppedSending: m.stoppedSendingAt !== null,
        promptCount: c?.promptCount ?? 0,
        toolCount: c?.toolCount ?? 0,
        failedCount: c?.failedCount ?? 0,
        clearCount: c?.clearCount ?? 0,
        compactCount: c?.compactCount ?? 0,
        permissionCount: c?.permissionCount ?? 0,
        flags: flags.map(f => f.code),
        note: m.mentorNote,
        examples: marked
          .filter(e => e.memberId === m.id)
          .map(e => ({ at: e.receivedAt, kind: e.kind, prompt: e.prompt, toolName: e.toolName, toolTarget: e.toolTarget, ok: e.ok, subtype: e.subtype })),
      });
    }

    const text = buildReport({ trainingName: training.name, exportedAt: now, members: rows });
    if (!options.preview) {
      await this.deps.unitOfWork.run(({ trainings }) => trainings.update(trainingId, { reportExportedAt: now }));
      await this.deps.signals.signal(trainingId);
    }
    return text;
  }
}
