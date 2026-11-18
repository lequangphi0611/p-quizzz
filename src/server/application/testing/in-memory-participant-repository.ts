import { EmailTakenError, NameTakenError } from '../../domain/participant/errors.js';
import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import type { ParticipantReader, ParticipantRepository } from '../ports/participant-repository.js';
import type { LobbyHeadcount } from '../ports/session-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/**
 * Test double for the participant ports (and the lobby headcount of the sessions module). Mimics the database's name index
 * (same session, case-insensitive ASCII, not kicked).
 */
export class InMemoryParticipantRepository implements ParticipantRepository, ParticipantReader, LobbyHeadcount, Snapshottable {
  private rows = new Map<number, Participant>();
  private nextId = 1;

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async findByToken(token: string) {
    return [...this.rows.values()].find(p => p.token === token) ?? null;
  }

  async findByReplacedToken(token: string) {
    return [...this.rows.values()].find(p => p.replacedToken === token) ?? null;
  }

  async namesOf(sessionId: number) {
    return this.inSession(sessionId).map(p => ({ id: p.id, displayName: p.displayName }));
  }

  async listNotKicked(sessionId: number) {
    return this.inSession(sessionId).filter(p => p.status !== 'kicked').map(p => ({ id: p.id, displayName: p.displayName, email: p.email, status: p.status, rejoinAllowedUntil: p.rejoinAllowedUntil }));
  }

  async listActiveNames(sessionId: number) {
    return this.inSession(sessionId).filter(p => p.status === 'active').map(p => ({ displayName: p.displayName }));
  }

  async add(p: NewParticipant) {
    const clash = this.inSession(p.sessionId).some(o => o.status !== 'kicked' && o.displayName.toLowerCase() === p.displayName.toLowerCase());
    if (p.status !== 'kicked' && p.email !== null && this.inSession(p.sessionId).some(o => o.status !== 'kicked' && o.email === p.email)) throw new EmailTakenError();
    if (p.status !== 'kicked' && clash) throw new NameTakenError('identity_in_use');
    const row: Participant = { ...p, replacedToken: null, rejoinAllowedUntil: null, readyAt: null, presentAtStart: false, id: this.nextId++ };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: number, patch: { displayName?: string; status?: ParticipantStatus }) {
    const row = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, row);
    return row;
  }

  async replaceToken(id: number, newToken: string) {
    const old = this.rows.get(id)!;
    const row = { ...old, token: newToken, replacedToken: old.token };
    this.rows.set(id, row);
    return row;
  }

  async setRejoinAllowedUntil(id: number, until: Date | null) {
    this.rows.set(id, { ...this.rows.get(id)!, rejoinAllowedUntil: until });
  }

  async setReady(id: number, at: Date | null) {
    this.rows.set(id, { ...this.rows.get(id)!, readyAt: at });
  }

  async count(sessionId: number) {
    const all = this.inSession(sessionId);
    const active = all.filter(p => p.status === 'active');
    return { total: active.length, ready: active.filter(p => p.readyAt !== null).length, pending: all.filter(p => p.status === 'pending').length };
  }

  async markPresentAtStart(sessionId: number) {
    for (const p of this.inSession(sessionId)) if (p.status === 'active') this.rows.set(p.id, { ...p, presentAtStart: true });
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
