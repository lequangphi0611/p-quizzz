import { TrainingEventNotFoundError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { analyzeEvents } from '../../../domain/training/flags/index.js';
import type { ExampleDraftStatus, FlagCode } from '../../../../shared/api/training.js';
import type { PermissionDecisionInfo } from '../../../domain/training/flags/flag-event.js';
import { buildSummary } from '../../../domain/training/summary.js';
import type { Clip } from '../../../domain/training/clip.js';
import type { ExampleDraftSummary, LightEvent, TrainingEventReader } from '../../ports/training-event-repository.js';
import type { TrainingMemberReader, TrainingReader } from '../../ports/training-repository.js';

/** Events per page of a member's timeline. */
export const EVENTS_PAGE_SIZE = 500;

/** One line of the timeline: what the member asked or ran, with a one-glance summary, and whether there is more to open. */
export interface TimelineEvent {
  id: number;
  kind: LightEvent['kind'];
  receivedAt: Date;
  claudeSessionId: string;
  prompt: string | null;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
  durationMs: number | null;
  summary: string | null;
  hasOutput: boolean;
  hasChange: boolean;
  note: string | null;
  subtype: string | null;
  /** `permission` rows: inferred from what ran afterwards. */
  decision: PermissionDecisionInfo['decision'] | null;
  decisionMs: number | null;
  /** Only when it is not `default`. */
  permissionMode: string | null;
  marked: boolean;
  teachingLabel: LightEvent['teachingLabel'];
  /** S45, prompt rows: the AI draft of the example, for the example button. */
  exampleDraft: { status: ExampleDraftStatus; seen: boolean; suspicious: boolean; error: string | null } | null;
}

export interface TimelinePage {
  events: TimelineEvent[];
  hasMore: boolean;
  /** Over the member's whole timeline, not only this page. */
  flags: { code: FlagCode; eventIds: number[] }[];
}

const toTimelineEvent = (e: LightEvent, decision: PermissionDecisionInfo | undefined, draft: ExampleDraftSummary | undefined): TimelineEvent => ({
  id: e.id,
  kind: e.kind,
  receivedAt: e.receivedAt,
  claudeSessionId: e.claudeSessionId,
  prompt: e.prompt,
  toolName: e.toolName,
  toolTarget: e.toolTarget,
  ok: e.ok,
  durationMs: e.durationMs,
  summary: e.kind === 'tool' ? buildSummary({ ok: e.ok === true, errorExcerpt: e.errorExcerpt, outputEnd: e.outputEnd }) : null,
  hasOutput: e.hasOutput,
  hasChange: e.hasChange,
  note: e.note,
  subtype: e.subtype,
  decision: e.kind === 'permission' ? (decision?.decision ?? 'pending') : null,
  decisionMs: decision?.decisionMs ?? null,
  permissionMode: e.permissionMode === null || e.permissionMode === 'default' ? null : e.permissionMode,
  marked: e.marked,
  teachingLabel: e.teachingLabel,
  exampleDraft: e.kind === 'prompt' && draft ? { status: draft.status, seen: draft.seen, suspicious: draft.suspicious, error: draft.error } : null,
});

/** Once ended the members and their events are gone for good: reviewing is a conflict, not a "not found". */
async function openTraining(trainings: TrainingReader, id: number) {
  const training = await trainings.findById(id);
  if (!training) throw new TrainingNotFoundError();
  if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc, dữ liệu đã bị xoá');
  return training;
}

/** A member's timeline in the order received, a page at a time (`after` = the last event id the screen already has). */
export class ListMemberEvents {
  constructor(private readonly deps: { trainings: TrainingReader; members: TrainingMemberReader; events: TrainingEventReader }) {}

  async execute(trainingId: number, memberId: number, after = 0): Promise<TimelinePage> {
    const training = await openTraining(this.deps.trainings, trainingId);
    const member = await this.deps.members.findById(memberId);
    if (!member || member.trainingId !== trainingId) throw new TrainingMemberNotFoundError();
    const rows = await this.deps.events.listLight(memberId, after, EVENTS_PAGE_SIZE + 1);
    const { flags, decisions } = analyzeEvents(await this.deps.events.listForFlags(memberId), { allowAutoAccept: training.allowAutoAccept });
    const drafts = new Map((await this.deps.events.listExampleDrafts(trainingId)).map(d => [d.eventId, d]));
    return { events: rows.slice(0, EVENTS_PAGE_SIZE).map(e => toTimelineEvent(e, decisions.get(e.id), drafts.get(e.id))), hasMore: rows.length > EVENTS_PAGE_SIZE, flags };
  }
}

/** The output and the change of one event: read only when the mentor asks to see them. */
export class GetTrainingEventDetail {
  constructor(private readonly deps: { trainings: TrainingReader; events: TrainingEventReader }) {}

  async execute(trainingId: number, eventId: number): Promise<{ output: Clip | null; change: Clip | null }> {
    await openTraining(this.deps.trainings, trainingId);
    const detail = await this.deps.events.getDetail(eventId);
    if (!detail || detail.trainingId !== trainingId) throw new TrainingEventNotFoundError();
    return { output: detail.output, change: detail.change };
  }
}
