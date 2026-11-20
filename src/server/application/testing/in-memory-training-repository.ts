import { NameTakenError } from '../../domain/participant/errors.js';
import { TrainingNotFoundError } from '../../domain/training/errors.js';
import type { Training, TrainingMember } from '../../domain/training/training.js';
import type {
  NewTraining, NewTrainingMember, TrainingListItem, TrainingMemberRepository, TrainingPatch, TrainingReader, TrainingRepository,
} from '../ports/training-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for the training ports. Members are shared with `InMemoryTrainingMemberRepository` so deletes cascade. */
export class InMemoryTrainingRepository implements TrainingRepository, TrainingReader, Snapshottable {
  private rows = new Map<number, Training>();
  private nextId = 1;

  /** Codes held by sessions in this scenario (the real database checks the sessions table). */
  readonly sessionCodes = new Set<string>();

  constructor(private readonly members: InMemoryTrainingMemberRepository) {}

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async findOpenByRoomCode(code: string) {
    return [...this.rows.values()].find(t => t.roomCode === code) ?? null;
  }

  async list(): Promise<TrainingListItem[]> {
    return [...this.rows.values()].reverse().map(t => ({ ...t, liveMemberCount: this.members.countSync(t.id) }));
  }

  async create(t: NewTraining) {
    const row: Training = { id: this.nextId++, name: t.name, status: 'open', roomCode: t.roomCode, createdAt: t.createdAt, stoppedAt: null, endedAt: null, memberCount: null };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: number, patch: TrainingPatch) {
    const old = this.rows.get(id);
    if (!old) throw new TrainingNotFoundError();
    const row = { ...old, ...patch };
    this.rows.set(id, row);
    return row;
  }

  async roomCodeInUse(code: string) {
    return this.sessionCodes.has(code) || [...this.rows.values()].some(t => t.roomCode === code);
  }

  snapshot() {
    return { rows: new Map(this.rows), nextId: this.nextId };
  }

  restore(s: unknown) {
    const snap = s as { rows: Map<number, Training>; nextId: number };
    this.rows = new Map(snap.rows);
    this.nextId = snap.nextId;
  }
}

export class InMemoryTrainingMemberRepository implements TrainingMemberRepository, Snapshottable {
  private rows = new Map<number, TrainingMember>();
  private nextId = 1;

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async findByToken(token: string) {
    return [...this.rows.values()].find(m => m.token === token) ?? null;
  }

  async findByIngestToken(token: string) {
    return [...this.rows.values()].find(m => m.ingestToken === token) ?? null;
  }

  async listByTraining(trainingId: number) {
    return [...this.rows.values()].filter(m => m.trainingId === trainingId);
  }

  /** Mimics the database's name index (same training, ASCII case-insensitive). */
  async add(m: NewTrainingMember) {
    if ([...this.rows.values()].some(o => o.trainingId === m.trainingId && o.displayName.toLowerCase() === m.displayName.toLowerCase())) throw new NameTakenError('identity_in_use');
    const row: TrainingMember = { ...m, id: this.nextId++, firstSeenAt: null, lastSeenAt: null, seenAfterStopAt: null, uninstallCheckAt: null, uninstalledAt: null };
    this.rows.set(row.id, row);
    return row;
  }

  async delete(id: number) {
    this.rows.delete(id);
  }

  async deleteByTraining(trainingId: number) {
    const ids = [...this.rows.values()].filter(m => m.trainingId === trainingId).map(m => m.id);
    ids.forEach(id => this.rows.delete(id));
    return ids.length;
  }

  async count(trainingId: number) {
    return this.countSync(trainingId);
  }

  private patch(id: number, change: Partial<TrainingMember>) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...change });
  }

  async recordSeen(id: number, at: Date) {
    this.patch(id, { firstSeenAt: this.rows.get(id)?.firstSeenAt ?? at, lastSeenAt: at });
  }

  async recordSeenAfterStop(id: number, at: Date) {
    this.patch(id, { seenAfterStopAt: at });
  }

  async startUninstallCheck(id: number, at: Date) {
    this.patch(id, { uninstallCheckAt: at });
  }

  async finishUninstall(id: number, at: Date) {
    this.patch(id, { uninstalledAt: at });
  }

  countSync(trainingId: number) {
    return [...this.rows.values()].filter(m => m.trainingId === trainingId).length;
  }

  snapshot() {
    return { rows: new Map(this.rows), nextId: this.nextId };
  }

  restore(s: unknown) {
    const snap = s as { rows: Map<number, TrainingMember>; nextId: number };
    this.rows = new Map(snap.rows);
    this.nextId = snap.nextId;
  }
}
