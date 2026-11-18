import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import type { RejoinRequestRepository } from './rejoin-repository.js';
import type { SessionRepository } from './session-repository.js';

/** Write side: only reachable inside a unit of work (see `ParticipantUnitContext`). */
export interface ParticipantRepository {
  findById(id: number): Promise<Participant | null>;
  /** Everyone in the session who has not been kicked: the names that are taken. */
  listNotKicked(sessionId: number): Promise<{ id: number; displayName: string; email: string | null; status: ParticipantStatus; rejoinAllowedUntil: Date | null }[]>;
  /** Throws `NameTakenError` / `EmailTakenError` when the database's unique name / email index rejects the row. */
  add(participant: NewParticipant): Promise<Participant>;
  update(id: number, patch: { displayName?: string; status?: ParticipantStatus }): Promise<Participant>;
  /** A new device takes the seat: `token` becomes `newToken`, and the old one is remembered as replaced. */
  replaceToken(id: number, newToken: string): Promise<Participant>;
  /** "Sẵn sàng" in the lobby (PRODUCT.md §7.31d); null = not ready. */
  setReady(id: number, at: Date | null): Promise<void>;
  /** The mentor's "let them back in" window (null clears it; also used when it is spent). */
  setRejoinAllowedUntil(id: number, until: Date | null): Promise<void>;
}

export interface ParticipantReader {
  /** Every participant of the session (kicked ones too), with names: the screens label counted attempts with them. */
  namesOf(sessionId: number): Promise<{ id: number; displayName: string }[]>;
  findById(id: number): Promise<Participant | null>;
  findByToken(token: string): Promise<Participant | null>;
  /** The person whose seat this (old) token belonged to before the mentor let someone back in. */
  findByReplacedToken(token: string): Promise<Participant | null>;
  /** Names of `active` members in join order (the projector's list). */
  listActiveNames(sessionId: number): Promise<{ displayName: string }[]>;
}

export interface ParticipantUnitContext {
  sessions: SessionRepository;
  participants: ParticipantRepository;
}

export interface RejoinUnitContext extends ParticipantUnitContext {
  rejoin: RejoinRequestRepository;
}
