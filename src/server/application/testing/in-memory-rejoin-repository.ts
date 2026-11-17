import type { RejoinRequest, RejoinStatus } from '../../domain/rejoin/rejoin.js';
import type { RejoinRequestReader, RejoinRequestRepository } from '../ports/rejoin-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for the rejoin-request ports. */
export class InMemoryRejoinRepository implements RejoinRequestRepository, RejoinRequestReader, Snapshottable {
  private rows = new Map<number, RejoinRequest>();
  private nextId = 1;

  async create(input: { participantId: number; claimantName: string; token: string; now: Date }) {
    const row: RejoinRequest = { id: this.nextId++, participantId: input.participantId, claimantName: input.claimantName, token: input.token, status: 'pending', createdAt: input.now, resolvedAt: null };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async findByToken(token: string) {
    return [...this.rows.values()].find(r => r.token === token) ?? null;
  }

  async pendingOf(participantId: number) {
    return [...this.rows.values()].filter(r => r.participantId === participantId && r.status === 'pending').sort((a, b) => a.id - b.id);
  }

  async setStatus(id: number, status: RejoinStatus, now: Date) {
    this.rows.set(id, { ...this.rows.get(id)!, status, resolvedAt: now });
  }

  snapshot() {
    return { rows: new Map(this.rows), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemoryRejoinRepository['snapshot']>;
    this.rows = s.rows;
    this.nextId = s.nextId;
  }
}
