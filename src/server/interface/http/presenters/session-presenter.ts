import type { ActiveSession, ScreenSessionItem, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { ActiveSessionView, ScreenSessionView, SessionDetailView, SessionSummaryView } from '../../../application/ports/session-repository.js';
import type { PresenceTracker } from '../../../application/ports/presence-tracker.js';
import { areScoresHidden } from '../../../domain/session/score-visibility.js';

const ms = (d: Date | null) => (d ? d.getTime() : null);

export const toSessionSummaryDto = (s: SessionSummaryView): SessionSummary => ({
  id: s.id,
  examId: s.examId,
  examTitle: s.examTitle,
  name: s.name,
  slot: s.slot,
  access: s.access,
  outsiderPolicy: s.outsiderPolicy,
  rosterSource: s.rosterSource,
  mode: s.mode,
  status: s.status,
  shuffle: s.shuffle,
  autoApprove: s.autoApprove,
  scoreVisibility: s.scoreVisibility,
  scoresReleasedAt: ms(s.scoresReleasedAt),
  scoresHidden: areScoresHidden(s),
  roomCode: s.roomCode,
  createdAt: s.createdAt.getTime(),
  openedAt: ms(s.openedAt),
  startedAt: ms(s.startedAt),
  closedAt: ms(s.closedAt),
  finalizedAt: ms(s.finalizedAt),
  participantCount: s.participantCount,
});

// `presence` says who is still connected; without it (tests of the pure shape) everyone reads as not seen.
export const toSessionDetailDto = (s: SessionDetailView, presence?: Pick<PresenceTracker, 'connectionOf'>): SessionDetail => ({
  ...toSessionSummaryDto(s),
  exam: s.exam,
  participants: s.participants.map(p => ({
    id: p.id, displayName: p.displayName, status: p.status, joinedAt: p.joinedAt.getTime(), progress: p.progress, email: p.email,
    connection: presence?.connectionOf(p.id) ?? { online: false, lastSeenAt: null },
    rejoinAllowedUntil: p.rejoinAllowedUntil ? p.rejoinAllowedUntil.getTime() : null,
  })),
  roster: s.roster,
  rejoinRequests: s.rejoinRequests.map(r => ({ id: r.id, participantId: r.participantId, claimantName: r.claimantName, requestedAt: r.requestedAt.getTime() })),
});

export const toActiveSessionDto = (s: ActiveSessionView): ActiveSession => ({ id: s.id, title: s.title, status: s.status, access: s.access });

export const toScreenSessionDto = (s: ScreenSessionView): ScreenSessionItem => ({ id: s.id, name: s.name, slot: s.slot, title: s.title, status: s.status });
