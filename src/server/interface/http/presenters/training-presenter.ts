import type { CreatedTraining, ExampleDraftRow, TrainingDetail, TrainingEventRow, TrainingEventsPage, TrainingSummary } from '../../../../shared/api/training.js';
import type { TimelineEvent, TimelinePage } from '../../../application/use-cases/training/view.js';
import type { TrainingDetailView } from '../../../application/use-cases/training/admin.js';
import type { ExampleDraftRecord } from '../../../application/ports/training-event-repository.js';
import type { TrainingListItem } from '../../../application/ports/training-repository.js';
import type { Training } from '../../../domain/training/training.js';

const ms = (d: Date | null) => (d ? d.getTime() : null);

// Built field by field on purpose: a training row must never reach the wire as it is.
export const toTrainingSummaryDto = (t: TrainingListItem): TrainingSummary => ({
  id: t.id,
  name: t.name,
  status: t.status,
  createdAt: t.createdAt.getTime(),
  stoppedAt: ms(t.stoppedAt),
  endedAt: ms(t.endedAt),
  // Counted live until the end; the stored count is all that is left afterwards.
  memberCount: t.status === 'ended' ? (t.memberCount ?? 0) : t.liveMemberCount,
});

export const toCreatedTrainingDto = (t: Training): CreatedTraining => ({
  id: t.id,
  name: t.name,
  status: t.status,
  roomCode: t.roomCode ?? '',
  createdAt: t.createdAt.getTime(),
  stoppedAt: ms(t.stoppedAt),
  endedAt: ms(t.endedAt),
  memberCount: 0,
});

export const toTrainingDetailDto = ({ training, uninstalled, flagCounts, unexportedExampleCount, aiDraftAvailable, exampleDrafts, members }: TrainingDetailView): TrainingDetail => ({
  id: training.id,
  name: training.name,
  status: training.status,
  roomCode: training.status === 'open' ? training.roomCode : null,
  createdAt: training.createdAt.getTime(),
  stoppedAt: ms(training.stoppedAt),
  endedAt: ms(training.endedAt),
  uninstalled,
  allowAutoAccept: training.allowAutoAccept,
  flagCounts,
  unexportedExampleCount,
  aiDraftAvailable,
  exampleDrafts,
  reportExportedAt: ms(training.reportExportedAt),
  members: members.map(m => ({
    id: m.id,
    displayName: m.displayName,
    connection: m.connection,
    lastSeenAt: ms(m.lastSeenAt),
    promptCount: m.promptCount,
    toolCount: m.toolCount,
    failedCount: m.failedCount,
    stuck: m.stuck,
    stillSending: m.stillSending,
    stoppedSending: m.stoppedSending,
    flags: m.flags,
    clearCount: m.clearCount,
    compactCount: m.compactCount,
    permissionCount: m.permissionCount,
    mentorNote: m.mentorNote,
    markedCount: m.markedCount,
    teachingConsent: m.teachingConsent,
    exampleDrafts: m.exampleDrafts,
  })),
});

// Optional fields are left out when they do not apply, so a prompt row carries no `toolName` and a tool row no `prompt`.
const toEventRowDto = (e: TimelineEvent): TrainingEventRow => ({
  id: e.id,
  kind: e.kind,
  receivedAt: e.receivedAt.getTime(),
  claudeSessionId: e.claudeSessionId,
  ...(e.prompt !== null ? { prompt: e.prompt } : {}),
  ...(e.toolName !== null ? { toolName: e.toolName } : {}),
  ...(e.toolTarget !== null ? { toolTarget: e.toolTarget } : {}),
  ...(e.ok !== null ? { ok: e.ok } : {}),
  ...(e.durationMs !== null ? { durationMs: e.durationMs } : {}),
  ...(e.summary !== null ? { summary: e.summary } : {}),
  hasOutput: e.hasOutput,
  hasChange: e.hasChange,
  marked: e.marked,
  teachingExample: e.kind === 'prompt' && e.teachingLabel ? { label: e.teachingLabel } : null,
  exampleDraft: e.exampleDraft,
  ...(e.note !== null ? { note: e.note } : {}),
  ...(e.subtype !== null ? { subtype: e.subtype } : {}),
  ...(e.decision !== null ? { decision: e.decision } : {}),
  ...(e.decisionMs !== null ? { decisionMs: e.decisionMs } : {}),
  ...(e.permissionMode !== null ? { permissionMode: e.permissionMode } : {}),
});

export const toEventsPageDto = (page: TimelinePage): TrainingEventsPage => ({ events: page.events.map(toEventRowDto), hasMore: page.hasMore, flags: page.flags });

/** The draft as the mentor's screen gets it: the content only once it is done, the reason only once it failed. */
export const toExampleDraftRowDto = (d: ExampleDraftRecord): ExampleDraftRow => ({
  eventId: d.eventId,
  status: d.status,
  draft:
    d.status === 'done' && d.label && d.topic
      ? {
          label: d.label,
          topic: d.topic,
          comment: d.comment ?? '',
          betterPrompt: d.betterPrompt,
          suspicious: d.suspicious,
          suspiciousReason: d.suspiciousReason ?? '',
          suspiciousQuote: d.suspiciousQuote ?? '',
        }
      : null,
  sampleCount: d.status === 'done' ? d.sampleCount : null,
  error: d.status === 'failed' ? d.error : null,
  seen: d.seenAt !== null,
  createdAt: d.createdAt.toISOString(),
});
