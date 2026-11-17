import type { ExamSummary, GroupSummary, LeaderboardResponse, OutsiderPolicy, ParticipantReview, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { SessionAction } from '../../../../shared/session-state.js';

import type { NewSessionAccess } from '../domain/access-ui.js';

export interface NewSession {
  examId: number;
  /** Mentor-only label; blank = the server's default. */
  name?: string;
  shuffle: boolean;
  autoApprove: boolean;
  access?: NewSessionAccess;
  /** Roster sessions: turn outsiders away (default) or let them wait for the mentor. */
  outsiderPolicy?: OutsiderPolicy;
}

/** Port: everything the mentor's session pages need from the server. Failures reject with `ApiError`. */
export interface SessionAdminGateway {
  listSessions(): Promise<SessionSummary[]>;
  listExams(): Promise<ExamSummary[]>;
  createSession(input: NewSession): Promise<SessionDetail>;
  /** Saved groups, for the "Chỉ nhóm" choice when creating a session. */
  listGroups(): Promise<GroupSummary[]>;
  /** Lets more emails into ONE session's list (the saved group it came from is untouched). */
  addRoster(sessionId: number, emails: string[]): Promise<SessionDetail>;
  /** Saves the session's typed list as a group; resolves with the new group's name and size. */
  saveGroup(sessionId: number, name: string): Promise<{ id: number; name: string; emailCount: number }>;
  getSession(id: number): Promise<SessionDetail>;
  /** open / start / close / finalize; returns the updated session. */
  runAction(id: number, action: SessionAction): Promise<SessionDetail>;
  approveParticipant(participantId: number): Promise<void>;
  kickParticipant(participantId: number): Promise<void>;
  /** Approve or reject a member's request to edit their essays (PRODUCT.md §7.21). */
  resolveEditRequest(participantId: number, decision: 'approve' | 'reject'): Promise<void>;
  renameParticipant(participantId: number, displayName: string): Promise<void>;
  /** Answers a request to take over a seat (PRODUCT.md §7.23c): keep the work / "this is an impostor" / reject. */
  answerRejoin(requestId: number, answer: 'keep' | 'takeover' | 'reject'): Promise<void>;
  /** Lets a member who dropped off back in without waiting: the next time they enter their email/name (one time, 10 minutes). Resolves with the deadline (epoch ms). */
  allowRejoin(participantId: number): Promise<number>;
  getParticipantReview(participantId: number): Promise<ParticipantReview>;
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse>;
  /** LAN addresses members can type (`/api/network`). */
  getJoinHosts(): Promise<string[]>;
}
