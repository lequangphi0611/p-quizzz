import { displayNameKey } from '../../../shared/api/participants.js';
import { ACTIVE_STATUSES, type SessionStatus } from '../../../shared/session-state.js';
import { DomainError } from '../errors.js';

export type RejoinStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface RejoinRequest {
  id: number;
  /** The person whose seat is being claimed (the holder). */
  participantId: number;
  /** The name the claimant typed: used only if the mentor answers "this is an impostor" and lets them in as a new person. */
  claimantName: string;
  /** The token the claimant holds; it becomes the participant's token when the mentor approves. */
  token: string;
  status: RejoinStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** What the claimant sees: a request still waiting when the session is no longer open has expired (derived, never stored). */
export type RejoinView = RejoinStatus | 'expired';
export function viewOf(request: Pick<RejoinRequest, 'status'>, sessionStatus: SessionStatus): RejoinView {
  return request.status === 'pending' && !ACTIVE_STATUSES.includes(sessionStatus) ? 'expired' : request.status;
}

/** One holder may have a few people claiming the seat (the real one and an impostor): more than this is spam. */
export const MAX_PENDING_PER_HOLDER = 5;

/** How long a "let them back in" permission from the mentor lasts, and it works once (PRODUCT.md §7.23e). */
export const ALLOW_REJOIN_MS = 10 * 60_000;

export class RejoinRequestNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy yêu cầu vào lại');
  }
}

export class RejoinNotPendingError extends DomainError {
  constructor() {
    super('conflict', 'Yêu cầu này đã được xử lý');
  }
}

/** The email/name the member typed has nobody behind it any more (they left or were kicked): just join normally. */
export class NoHolderError extends DomainError {
  constructor() {
    super('conflict', 'Không còn ai giữ chỗ này, hãy thử vào phòng lại');
  }
}

export class TooManyRequestsError extends DomainError {
  constructor() {
    super('conflict', 'Đã có nhiều yêu cầu cho chỗ này, hãy báo mentor');
  }
}

export class NotRejoinableError extends DomainError {
  constructor() {
    super('conflict', 'Chỉ cho vào lại được khi phiên còn mở và người đó chưa bị mời ra');
  }
}


/**
 * Who holds the seat the member is asking for: in a roster session the email decides, in a free session the name (PRODUCT.md §7.23).
 * Kicked people hold nothing (the list given is already without them).
 */
export function findHolder<T extends { displayName: string; email: string | null }>(
  others: readonly T[],
  session: { access: 'free' | 'roster' },
  who: { email: string | null; displayName: string },
): T | undefined {
  if (session.access === 'roster') return who.email ? others.find(o => o.email === who.email) : undefined;
  const key = displayNameKey(who.displayName);
  return others.find(o => displayNameKey(o.displayName) === key);
}
