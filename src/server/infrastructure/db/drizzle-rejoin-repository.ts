import { and, asc, eq } from 'drizzle-orm';
import type { RejoinRequestReader, RejoinRequestRepository } from '../../application/ports/rejoin-repository.js';
import type { RejoinRequest, RejoinStatus } from '../../domain/rejoin/rejoin.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { rejoinRequests } from './schema.js';

export class DrizzleRejoinRepository implements RejoinRequestRepository, RejoinRequestReader {
  constructor(private readonly access: DbAccess) {}

  create(input: { participantId: number; claimantName: string; token: string; now: Date }): Promise<RejoinRequest> {
    return this.access(db =>
      db.insert(rejoinRequests).values({ participantId: input.participantId, claimantName: input.claimantName, token: input.token, createdAt: input.now }).returning().get(),
    );
  }

  async findById(id: number): Promise<RejoinRequest | null> {
    return (await this.access(db => db.select().from(rejoinRequests).where(eq(rejoinRequests.id, id)).get())) ?? null;
  }

  async findByToken(token: string): Promise<RejoinRequest | null> {
    if (!token) return null;
    return (await this.access(db => db.select().from(rejoinRequests).where(eq(rejoinRequests.token, token)).get())) ?? null;
  }

  pendingOf(participantId: number): Promise<RejoinRequest[]> {
    return this.access(db =>
      db.select().from(rejoinRequests).where(and(eq(rejoinRequests.participantId, participantId), eq(rejoinRequests.status, 'pending'))).orderBy(asc(rejoinRequests.id)).all(),
    );
  }

  async setStatus(id: number, status: RejoinStatus, now: Date): Promise<void> {
    await this.access(db => db.update(rejoinRequests).set({ status, resolvedAt: now }).where(eq(rejoinRequests.id, id)).run());
  }
}
