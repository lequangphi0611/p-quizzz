import { TRAINING_EXPORT_MAX_BYTES, type TrainingExportQuery, type TrainingExportSummary } from '../../../../shared/api/training.js';
import { TrainingExportEmptyError, TrainingExportTooLargeError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { buildExportFiles, type ExportMemberInput } from '../../../domain/training/export.js';
import { resolveExportRange, type ExportRange } from '../../../domain/training/export-range.js';
import type { Training, TrainingMember } from '../../../domain/training/training.js';
import type { ArchiveWriter } from '../../ports/archive-writer.js';
import type { Clock } from '../../ports/clock.js';
import type { TrainingEventReader } from '../../ports/training-event-repository.js';
import type { TrainingMemberReader, TrainingReader } from '../../ports/training-repository.js';

interface Deps {
  trainings: TrainingReader;
  members: TrainingMemberReader;
  events: TrainingEventReader;
  clock: Clock;
  archive: ArchiveWriter;
}

interface Scope {
  training: Training;
  range: ExportRange;
  members: TrainingMember[];
}

/** The training, the days and the members an export asks for. Same rules as the report (PRODUCT.md §7.35e): who is still stored is who is in. */
async function resolveScope(deps: Deps, trainingId: number, query: TrainingExportQuery): Promise<Scope> {
  const training = await deps.trainings.findById(trainingId);
  if (!training) throw new TrainingNotFoundError();
  if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
  const all = await deps.members.listByTraining(trainingId);
  let members = all;
  if (query.members) {
    const byId = new Map(all.map(m => [m.id, m]));
    if (query.members.some(id => !byId.has(id))) throw new TrainingMemberNotFoundError();
    members = all.filter(m => query.members!.includes(m.id));
  }
  return { training, range: resolveExportRange(query, deps.clock.now()), members };
}

/** What the dialog shows before the file is built (PRODUCT.md §7.36a). */
export class GetTrainingExportSummary {
  constructor(private readonly deps: Deps) {}

  async execute(trainingId: number, query: TrainingExportQuery): Promise<TrainingExportSummary> {
    const { range, members } = await resolveScope(this.deps, trainingId, query);
    const stats = await this.deps.events.exportStats(trainingId, range);
    let eventCount = 0;
    let approxBytes = 0;
    for (const m of members) {
      eventCount += stats.get(m.id)?.eventCount ?? 0;
      approxBytes += stats.get(m.id)?.approxBytes ?? 0;
    }
    return { from: range.fromDay, to: range.toDay, memberCount: members.length, eventCount, approxBytes, tooLarge: approxBytes > TRAINING_EXPORT_MAX_BYTES };
  }
}

export interface TrainingExportFile {
  /** Suggested download name. */
  fileName: string;
  data: Buffer;
  summary: TrainingExportSummary;
}

/**
 * The raw export for the mentor's own AI (PRODUCT.md §7.36): a zip with `00-tong-quan.md` and one Markdown file per member,
 * output and file changes included, secrets masked. It is not the report: nothing is recorded as exported, and the app never calls an AI here.
 */
export class ExportTrainingData {
  private readonly summary: GetTrainingExportSummary;

  constructor(private readonly deps: Deps) {
    this.summary = new GetTrainingExportSummary(deps);
  }

  async execute(trainingId: number, query: TrainingExportQuery): Promise<TrainingExportFile> {
    const summary = await this.summary.execute(trainingId, query);
    if (summary.eventCount === 0) throw new TrainingExportEmptyError();
    if (summary.tooLarge) throw new TrainingExportTooLargeError(summary.approxBytes);
    const { training, range, members } = await resolveScope(this.deps, trainingId, query);

    // One member at a time, so only one member's events are in memory besides the text already built.
    const inputs: ExportMemberInput[] = [];
    for (const m of members) {
      inputs.push({ displayName: m.displayName, stoppedSending: m.stoppedSendingAt !== null, note: m.mentorNote, events: await this.deps.events.listForExport(m.id, range) });
    }
    const files = buildExportFiles({ trainingName: training.name, range, exportedAt: this.deps.clock.now(), allowAutoAccept: training.allowAutoAccept, members: inputs });
    const data = await this.deps.archive.zip(files);
    const days = range.fromDay === range.toDay ? range.fromDay : `${range.fromDay}_${range.toDay}`;
    return { fileName: `du-lieu-training-${trainingId}-${days}.zip`, data, summary };
  }
}
