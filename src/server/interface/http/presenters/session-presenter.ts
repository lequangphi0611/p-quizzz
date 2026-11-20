import type { ActiveSession, ScreenSessionItem, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { ActiveSessionView, ScreenSessionView, SessionDetailView, SessionSummaryView } from '../../../application/ports/session-repository.js';
import type { PresenceTracker } from '../../../application/ports/presence-tracker.js';
import { areScoresHidden } from '../../../domain/session/score-visibility.js';
import { sessionTimer } from '../../../domain/session/time-limit.js';
import { sessionStartInfo } from '../../../domain/session/start.js';

const ms = (d: Date | null) => (d ? d.getTime() : null);

// `now` fixes `timer.remainingMs`. It must come from the injected Clock, the same one that sets and enforces the
// deadline (PRODUCT.md §7.27d), so callers pass it: no `new Date()` default.
export const toSessionSummaryDto = (s: SessionSummaryView, now: Date): SessionSummary => ({
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
  timeLimitMinutes: s.timeLimitMinutes,
  timer: sessionTimer(s, now),
  start: sessionStartInfo(s, { count: s.readyCount, total: s.participantCount }, now),
  startScheduleDroppedAt: ms(s.startScheduleDroppedAt),
  pendingCount: s.pendingCount,
  roomCode: s.roomCode,
  createdAt: s.createdAt.getTime(),
  openedAt: ms(s.openedAt),
  startedAt: ms(s.startedAt),
  closedAt: ms(s.closedAt),
  finalizedAt: ms(s.finalizedAt),
  sharedAt: ms(s.sharedAt),
  participantCount: s.participantCount,
});

// `presence` says who is still connected; without it (tests of the pure shape) everyone reads as not seen.
export const toSessionDetailDto = (s: SessionDetailView, now: Date, presence?: Pick<PresenceTracker, 'connectionOf'>): SessionDetail => ({
  ...toSessionSummaryDto(s, now),
  exam: s.exam,
  participants: s.participants.map(p => ({
    id: p.id, displayName: p.displayName, status: p.status, joinedAt: p.joinedAt.getTime(), readyAt: ms(p.readyAt), progress: p.progress, email: p.email,
    connection: presence?.connectionOf(p.id) ?? { online: false, lastSeenAt: null },
    rejoinAllowedUntil: p.rejoinAllowedUntil ? p.rejoinAllowedUntil.getTime() : null,
  })),
  roster: s.roster,
  rejoinRequests: s.rejoinRequests.map(r => ({ id: r.id, participantId: r.participantId, claimantName: r.claimantName, requestedAt: r.requestedAt.getTime() })),
  share: s.share,
});

export const toActiveSessionDto = (s: ActiveSessionView, now: Date): ActiveSession => ({
  id: s.id, title: s.title, status: s.status, access: s.access, timer: sessionTimer(s, now),
  start: sessionStartInfo(s, { count: s.readyCount, total: s.participantCount }, now),
});

export const toScreenSessionDto = (s: ScreenSessionView): ScreenSessionItem => ({ id: s.id, name: s.name, slot: s.slot, title: s.title, status: s.status });
