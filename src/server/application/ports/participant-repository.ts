import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import type { SessionRepository } from './session-repository.js';

/** Write side: only reachable inside a unit of work (see `ParticipantUnitContext`). */
export interface ParticipantRepository {
  findById(id: number): Promise<Participant | null>;
  /** Everyone in the session who has not been kicked: the names that are taken. */
  listNotKicked(sessionId: number): Promise<{ id: number; displayName: string; email: string | null }[]>;
  /** Throws `NameTakenError` / `EmailTakenError` when the database's unique name / email index rejects the row. */
  add(participant: NewParticipant): Promise<Participant>;
  update(id: number, patch: { displayName?: string; status?: ParticipantStatus }): Promise<Participant>;
}

export interface ParticipantReader {
  /** Every participant of the session (kicked ones too), with names: the screens label counted attempts with them. */
  namesOf(sessionId: number): Promise<{ id: number; displayName: string }[]>;
  findById(id: number): Promise<Participant | null>;
  findByToken(token: string): Promise<Participant | null>;
  /** Names of `active` members in join order (the projector's list). */
  listActiveNames(sessionId: number): Promise<{ displayName: string }[]>;
}

export interface ParticipantUnitContext {
  sessions: SessionRepository;
  participants: ParticipantRepository;
}
