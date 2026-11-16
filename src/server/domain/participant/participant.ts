import { displayNameKey } from '../../../shared/api/participants.js';
import { ACTIVE_STATUSES, type SessionStatus } from '../../../shared/session-state.js';
import { roomCodeMatches } from '../session/room-code.js';
import {
  NameTakenError,
  NotPendingError,
  ParticipantKickedError,
  SessionClosedForApprovalError,
  SessionFinalizedError,
  SessionNotOpenError,
  WrongRoomCodeError,
} from './errors.js';

export type ParticipantStatus = 'active' | 'pending' | 'kicked';

export interface Participant {
  id: number;
  sessionId: number;
  displayName: string;
  /** Secret: identifies the member's browser. Never leaves the server in a response. */
  token: string;
  status: ParticipantStatus;
  joinedAt: Date;
}

export type NewParticipant = Omit<Participant, 'id'>;

// Rules for who may be in a session. Pure: use cases load the facts and call these.

/** One name per real person, compared case-insensitively over all of Unicode (SQLite's lower() is ASCII-only). Kicked members free their name. */
export function assertNameFree(others: { id: number; displayName: string }[], name: string, exceptId?: number): void {
  const key = displayNameKey(name);
  if (others.some(o => o.id !== exceptId && displayNameKey(o.displayName) === key)) throw new NameTakenError();
}

/** Joining needs an active (lobby/running) session and its current room code. */
export function assertCanJoin(session: { status: SessionStatus; roomCode: string | null }, givenRoomCode: string): void {
  if (!ACTIVE_STATUSES.includes(session.status)) throw new SessionNotOpenError();
  if (!session.roomCode || !roomCodeMatches(session.roomCode, givenRoomCode)) throw new WrongRoomCodeError();
}

/**
 * By default everyone waits for the mentor, in the lobby too (PRODUCT.md §7.7): one name per real person, so a member
 * cannot join under several names and probe the answers through the scores. The mentor can opt out per session.
 */
export const statusOnJoin = (autoApprove: boolean): ParticipantStatus => (autoApprove ? 'active' : 'pending');

/** Results become official at FINALIZED; from then on nobody may be kicked, renamed or approved. */
export function assertListEditable(sessionStatus: SessionStatus | undefined): void {
  if (sessionStatus === 'finalized') throw new SessionFinalizedError();
}

export function assertNotKicked(p: Pick<Participant, 'status'>): void {
  if (p.status === 'kicked') throw new ParticipantKickedError();
}

/** Only a pending member can be approved, and only while people can still work. */
export function assertApprovable(p: Pick<Participant, 'status'>, sessionStatus: SessionStatus | undefined): void {
  if (p.status !== 'pending') throw new NotPendingError();
  if (!sessionStatus || !ACTIVE_STATUSES.includes(sessionStatus)) throw new SessionClosedForApprovalError();
}
