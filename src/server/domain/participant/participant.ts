import { displayNameKey } from '../../../shared/api/participants.js';
import { ACTIVE_STATUSES, type SessionStatus } from '../../../shared/session-state.js';
import { ReadyLockedError } from '../session/errors.js';
import { roomCodeMatches } from '../session/room-code.js';
import {
  EmailTakenError,
  NameTakenError,
  NotInRosterError,
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
  /** Normalized (lower-case) email in a roster session; null in a free one. Mentor-only data (PRODUCT.md §7.24). */
  email: string | null;
  /** Secret: identifies the member's browser. Never leaves the server in a response. */
  token: string;
  /** The token before the mentor let this person back in from another device; that old device is told it was replaced. */
  replacedToken: string | null;
  /** While in the future: entering this person's email/name again takes the seat over without asking (PRODUCT.md §7.23e). */
  rejoinAllowedUntil: Date | null;
  status: ParticipantStatus;
  joinedAt: Date;
  /** Pressed "Sẵn sàng" in the lobby (PRODUCT.md §7.31d); null = not ready. */
  readyAt: Date | null;
  /** Was approved and in the room when the session started: goes straight to question 1. Others joined late (§7.31f). */
  presentAtStart: boolean;
}

export type NewParticipant = Omit<Participant, 'id' | 'replacedToken' | 'rejoinAllowedUntil' | 'readyAt' | 'presentAtStart'>;

// Rules for who may be in a session. Pure: use cases load the facts and call these.

/** One name per real person, compared case-insensitively over all of Unicode (SQLite's lower() is ASCII-only). Kicked members free their name. */
export function assertNameFree(others: { id: number; displayName: string }[], name: string, exceptId?: number, onJoin = false): void {
  const key = displayNameKey(name);
  if (others.some(o => o.id !== exceptId && displayNameKey(o.displayName) === key)) throw new NameTakenError(onJoin ? 'identity_in_use' : undefined);
}

/** One person per email in a session (a kicked person frees theirs). Emails are already normalized. */
export function assertEmailFree(others: { email: string | null }[], email: string): void {
  if (others.some(o => o.email === email)) throw new EmailTakenError();
}

/**
 * A roster session only lets in the emails on its list (PRODUCT.md §7.22): they join straight away (the list is the
 * mentor's permission). Anyone else is turned away, or waits for the mentor when the session says `pending`.
 */
export function rosterDecision(onList: boolean, policy: 'block' | 'pending'): ParticipantStatus {
  if (onList) return 'active';
  if (policy === 'pending') return 'pending';
  throw new NotInRosterError();
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

/** "Sẵn sàng" / "Huỷ sẵn sàng": in the lobby, approved, and not once the 10-second countdown runs (PRODUCT.md §7.31c, d). */
export function assertCanSetReady(p: Pick<Participant, 'status'>, session: { status: SessionStatus; countdownEndsAt: Date | null }): void {
  if (session.status !== 'lobby') throw new ReadyLockedError('not_lobby');
  if (p.status !== 'active') throw new ReadyLockedError('not_active');
  if (session.countdownEndsAt) throw new ReadyLockedError('countdown');
}
