import type { ActiveSession, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { ActiveSessionView, SessionDetailView, SessionSummaryView } from '../../../application/ports/session-repository.js';

const ms = (d: Date | null) => (d ? d.getTime() : null);

export const toSessionSummaryDto = (s: SessionSummaryView): SessionSummary => ({
  id: s.id,
  examId: s.examId,
  examTitle: s.examTitle,
  mode: s.mode,
  status: s.status,
  shuffle: s.shuffle,
  autoApprove: s.autoApprove,
  roomCode: s.roomCode,
  createdAt: s.createdAt.getTime(),
  openedAt: ms(s.openedAt),
  startedAt: ms(s.startedAt),
  closedAt: ms(s.closedAt),
  finalizedAt: ms(s.finalizedAt),
  participantCount: s.participantCount,
});

export const toSessionDetailDto = (s: SessionDetailView): SessionDetail => ({
  ...toSessionSummaryDto(s),
  exam: s.exam,
  participants: s.participants.map(p => ({ id: p.id, displayName: p.displayName, status: p.status, joinedAt: p.joinedAt.getTime(), progress: p.progress })),
});

export const toActiveSessionDto = (s: ActiveSessionView): ActiveSession => ({ id: s.id, title: s.title, status: s.status });
