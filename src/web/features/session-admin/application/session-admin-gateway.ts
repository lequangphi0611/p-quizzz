import type { ExamSummary, LeaderboardResponse, ParticipantReview, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { SessionAction } from '../../../../shared/session-state.js';

export interface NewSession { examId: number; /** Mentor-only label; blank = the server's default. */ name?: string; shuffle: boolean; autoApprove: boolean }

/** Port: everything the mentor's session pages need from the server. Failures reject with `ApiError`. */
export interface SessionAdminGateway {
  listSessions(): Promise<SessionSummary[]>;
  listExams(): Promise<ExamSummary[]>;
  createSession(input: NewSession): Promise<SessionDetail>;
  getSession(id: number): Promise<SessionDetail>;
  /** open / start / close / finalize; returns the updated session. */
  runAction(id: number, action: SessionAction): Promise<SessionDetail>;
  approveParticipant(participantId: number): Promise<void>;
  kickParticipant(participantId: number): Promise<void>;
  /** Approve or reject a member's request to edit their essays (PRODUCT.md §7.21). */
  resolveEditRequest(participantId: number, decision: 'approve' | 'reject'): Promise<void>;
  renameParticipant(participantId: number, displayName: string): Promise<void>;
  getParticipantReview(participantId: number): Promise<ParticipantReview>;
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse>;
  /** LAN addresses members can type (`/api/network`). */
  getJoinHosts(): Promise<string[]>;
}
