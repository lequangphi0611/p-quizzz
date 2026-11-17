import type { SessionDetail, SessionSummary } from '../../../../shared/api/index.js';

/** Port: what the mentor's notification bell reads and does. Failures reject with `ApiError`. */
export interface MentorNoticesGateway {
  /** Sessions in lobby/running, lowest slot first. */
  listActive(): Promise<SessionSummary[]>;
  getSession(id: number): Promise<SessionDetail>;
  approveParticipant(participantId: number): Promise<void>;
  /** Answers a request to take over a seat (PRODUCT.md §7.23c). */
  answerRejoin(requestId: number, answer: 'keep' | 'takeover' | 'reject'): Promise<void>;
  /** Approve or reject a member's request to edit their essays (PRODUCT.md §7.21). */
  resolveEditRequest(participantId: number, decision: 'approve' | 'reject'): Promise<void>;
}

/** Port: the per-session "seen" mark (so a reload does not re-announce what the mentor already saw). */
export interface SeenStore {
  load(sessionId: number): number;
  save(sessionId: number, at: number): void;
}
