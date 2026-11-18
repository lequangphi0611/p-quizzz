import type { ExamSummary, GroupSummary, LeaderboardResponse, OutsiderPolicy, ParticipantReview, ScoreVisibility, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
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
  /** Show scores on submit (default) or hold them until the mentor publishes (PRODUCT.md §7.25). */
  scoreVisibility?: ScoreVisibility;
  /** Minutes, or null for no limit (PRODUCT.md §7.27). Omitted = the exam's `duration`. */
  timeLimitMinutes?: number | null;
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
  /** Switches between showing scores on submit and holding them (only while nobody has submitted). */
  setScoreVisibility(sessionId: number, scoreVisibility: ScoreVisibility): Promise<SessionDetail>;
  /** "Công bố điểm": held-back scores appear for members and the projector. */
  releaseScores(sessionId: number): Promise<SessionDetail>;
  /** Change, add or remove the time limit before the start (PRODUCT.md §7.27c). */
  setTimeLimit(sessionId: number, timeLimitMinutes: number | null): Promise<SessionDetail>;
  /** "+N phút" for the whole room while the session runs. */
  extendTime(sessionId: number, minutes: number): Promise<SessionDetail>;
  /** Set, move or remove the scheduled start (PRODUCT.md §7.31b); `startsAt` is epoch ms. */
  setStartSchedule(sessionId: number, startsAt: number | null): Promise<SessionDetail>;
  /** "Bắt đầu ngay": a 10-second countdown for the room (§7.31c). */
  startCountdown(sessionId: number): Promise<SessionDetail>;
  /** Cancels the countdown; also turns "everyone ready" off. */
  cancelCountdown(sessionId: number): Promise<SessionDetail>;
  /** "Tự bắt đầu khi tất cả sẵn sàng" and its least number of people (§7.31e). */
  setAutoStart(sessionId: number, enabled: boolean, minParticipants: number): Promise<SessionDetail>;
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
