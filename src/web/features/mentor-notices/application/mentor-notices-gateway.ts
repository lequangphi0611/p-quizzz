import type { ActiveSession, SessionDetail } from '../../../../shared/api/index.js';

/** Port: what the mentor's notification bell reads and does. Failures reject with `ApiError`. */
export interface MentorNoticesGateway {
  getActive(): Promise<ActiveSession | null>;
  getSession(id: number): Promise<SessionDetail>;
  approveParticipant(participantId: number): Promise<void>;
  /** Approve or reject a member's request to edit their essays (PRODUCT.md §7.21). */
  resolveEditRequest(participantId: number, decision: 'approve' | 'reject'): Promise<void>;
}

/** Port: the per-session "seen" mark (so a reload does not re-announce what the mentor already saw). */
export interface SeenStore {
  load(sessionId: number): number;
  save(sessionId: number, at: number): void;
}
