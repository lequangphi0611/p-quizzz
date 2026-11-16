import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import type { SessionRepository } from './session-repository.js';

/** Write side: only reachable inside a unit of work (see `ParticipantUnitContext`). */
export interface ParticipantRepository {
  findById(id: number): Promise<Participant | null>;
  /** Everyone in the session who has not been kicked: the names that are taken. */
  listNotKicked(sessionId: number): Promise<{ id: number; displayName: string }[]>;
  /** Throws `NameTakenError` when the database's unique name index rejects the row. */
  add(participant: NewParticipant): Promise<Participant>;
  update(id: number, patch: { displayName?: string; status?: ParticipantStatus }): Promise<Participant>;
}

export interface ParticipantReader {
  findById(id: number): Promise<Participant | null>;
  findByToken(token: string): Promise<Participant | null>;
  /** Names of `active` members in join order (the projector's list). */
  listActiveNames(sessionId: number): Promise<{ displayName: string }[]>;
}

export interface ParticipantUnitContext {
  sessions: SessionRepository;
  participants: ParticipantRepository;
}
