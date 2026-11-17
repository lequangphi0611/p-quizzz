import type { RejoinRequest, RejoinStatus } from '../../domain/rejoin/rejoin.js';

/** Write side: only reachable inside a unit of work (see `RejoinUnitContext`). */
export interface RejoinRequestRepository {
  create(input: { participantId: number; claimantName: string; token: string; now: Date }): Promise<RejoinRequest>;
  findById(id: number): Promise<RejoinRequest | null>;
  /** Pending requests for one holder, oldest first. */
  pendingOf(participantId: number): Promise<RejoinRequest[]>;
  setStatus(id: number, status: RejoinStatus, now: Date): Promise<void>;
}

export interface RejoinRequestReader {
  /** The request the claimant holds this token for (it reads only its own status). */
  findByToken(token: string): Promise<RejoinRequest | null>;
}
