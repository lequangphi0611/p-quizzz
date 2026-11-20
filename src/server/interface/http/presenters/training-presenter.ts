import type { CreatedTraining, TrainingDetail, TrainingSummary } from '../../../../shared/api/training.js';
import type { TrainingDetailView } from '../../../application/use-cases/training/admin.js';
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

export const toTrainingDetailDto = ({ training, uninstalled, members }: TrainingDetailView): TrainingDetail => ({
  id: training.id,
  name: training.name,
  status: training.status,
  roomCode: training.status === 'open' ? training.roomCode : null,
  createdAt: training.createdAt.getTime(),
  stoppedAt: ms(training.stoppedAt),
  endedAt: ms(training.endedAt),
  uninstalled,
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
  })),
});
