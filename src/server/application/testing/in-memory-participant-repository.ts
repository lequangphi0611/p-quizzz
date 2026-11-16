import { NameTakenError } from '../../domain/participant/errors.js';
import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import type { ParticipantReader, ParticipantRepository } from '../ports/participant-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for the participant ports. Mimics the database's name index (same session, case-insensitive ASCII, not kicked). */
export class InMemoryParticipantRepository implements ParticipantRepository, ParticipantReader, Snapshottable {
  private rows = new Map<number, Participant>();
  private nextId = 1;

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async findByToken(token: string) {
    return [...this.rows.values()].find(p => p.token === token) ?? null;
  }

  async listNotKicked(sessionId: number) {
    return this.inSession(sessionId).filter(p => p.status !== 'kicked').map(p => ({ id: p.id, displayName: p.displayName }));
  }

  async listActiveNames(sessionId: number) {
    return this.inSession(sessionId).filter(p => p.status === 'active').map(p => ({ displayName: p.displayName }));
  }

  async add(p: NewParticipant) {
    const clash = this.inSession(p.sessionId).some(o => o.status !== 'kicked' && o.displayName.toLowerCase() === p.displayName.toLowerCase());
    if (p.status !== 'kicked' && clash) throw new NameTakenError();
    const row = { ...p, id: this.nextId++ };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: number, patch: { displayName?: string; status?: ParticipantStatus }) {
    const row = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, row);
    return row;
  }

  snapshot() {
    return { rows: new Map(this.rows), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemoryParticipantRepository['snapshot']>;
    this.rows = s.rows;
    this.nextId = s.nextId;
  }

  private inSession(sessionId: number) {
    return [...this.rows.values()].filter(p => p.sessionId === sessionId);
  }
}
