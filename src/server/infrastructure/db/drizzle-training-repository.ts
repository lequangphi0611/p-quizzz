import { desc, eq, sql } from 'drizzle-orm';
import type {
  NewTraining, NewTrainingMember, TrainingListItem, TrainingMemberRepository, TrainingPatch, TrainingReader, TrainingRepository,
} from '../../application/ports/training-repository.js';
import { NameTakenError } from '../../domain/participant/errors.js';
import { TrainingNotFoundError } from '../../domain/training/errors.js';
import type { Training, TrainingMember } from '../../domain/training/training.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { roomCodeTaken } from './room-code-space.js';
import { trainingMembers, trainings } from './schema.js';

const isNameViolation = (err: unknown) =>
  err instanceof Error && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE' && err.message.includes('training_members_name_uq');

export class DrizzleTrainingRepository implements TrainingRepository, TrainingReader {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<Training | null> {
    return (await this.access(db => db.select().from(trainings).where(eq(trainings.id, id)).get())) ?? null;
  }

  async findOpenByRoomCode(code: string): Promise<Training | null> {
    if (!code) return null;
    return (await this.access(db => db.select().from(trainings).where(eq(trainings.roomCode, code)).get())) ?? null;
  }

  list(): Promise<TrainingListItem[]> {
    return this.access(db =>
      db
        .select({ training: trainings, live: sql<number>`(select count(*) from ${trainingMembers} where ${trainingMembers.trainingId} = ${trainings.id})` })
        .from(trainings)
        .orderBy(desc(trainings.createdAt), desc(trainings.id))
        .all()
        .map(r => ({ ...r.training, liveMemberCount: r.live })),
    );
  }

  create(training: NewTraining): Promise<Training> {
    return this.access(db => db.insert(trainings).values({ ...training, status: 'open' }).returning().get());
  }

  async update(id: number, patch: TrainingPatch): Promise<Training> {
    const row = await this.access(db => db.update(trainings).set(patch).where(eq(trainings.id, id)).returning().get());
    if (!row) throw new TrainingNotFoundError();
    return row;
  }

  roomCodeInUse(code: string): Promise<boolean> {
    return this.access(db => roomCodeTaken(db, code));
  }
}

export class DrizzleTrainingMemberRepository implements TrainingMemberRepository {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<TrainingMember | null> {
    return (await this.access(db => db.select().from(trainingMembers).where(eq(trainingMembers.id, id)).get())) ?? null;
  }

  async findByToken(token: string): Promise<TrainingMember | null> {
    if (!token) return null;
    return (await this.access(db => db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get())) ?? null;
  }

  async findByIngestToken(token: string): Promise<TrainingMember | null> {
    if (!token) return null;
    return (await this.access(db => db.select().from(trainingMembers).where(eq(trainingMembers.ingestToken, token)).get())) ?? null;
  }

  listByTraining(trainingId: number): Promise<TrainingMember[]> {
    return this.access(db => db.select().from(trainingMembers).where(eq(trainingMembers.trainingId, trainingId)).orderBy(trainingMembers.id).all());
  }

  async add(member: NewTrainingMember): Promise<TrainingMember> {
    try {
      return await this.access(db => db.insert(trainingMembers).values(member).returning().get());
    } catch (err) {
      if (isNameViolation(err)) throw new NameTakenError('identity_in_use');
      throw err;
    }
  }

  async delete(id: number): Promise<void> {
    await this.access(db => db.delete(trainingMembers).where(eq(trainingMembers.id, id)).run());
  }

  deleteByTraining(trainingId: number): Promise<number> {
    return this.access(db => db.delete(trainingMembers).where(eq(trainingMembers.trainingId, trainingId)).run().changes);
  }

  count(trainingId: number): Promise<number> {
    return this.access(db => db.select({ n: sql<number>`count(*)` }).from(trainingMembers).where(eq(trainingMembers.trainingId, trainingId)).get()!.n);
  }

  async recordSeen(id: number, at: Date): Promise<void> {
    await this.access(db =>
      db.update(trainingMembers).set({ firstSeenAt: sql`coalesce(${trainingMembers.firstSeenAt}, ${at.getTime()})`, lastSeenAt: at }).where(eq(trainingMembers.id, id)).run(),
    );
  }

  async stopSending(id: number, at: Date): Promise<void> {
    await this.access(db =>
      db.update(trainingMembers).set({ stoppedSendingAt: sql`coalesce(${trainingMembers.stoppedSendingAt}, ${at.getTime()})` }).where(eq(trainingMembers.id, id)).run(),
    );
  }

  async recordSeenAfterStop(id: number, at: Date): Promise<void> {
    await this.access(db => db.update(trainingMembers).set({ seenAfterStopAt: at }).where(eq(trainingMembers.id, id)).run());
  }

  async startUninstallCheck(id: number, at: Date): Promise<void> {
    await this.access(db => db.update(trainingMembers).set({ uninstallCheckAt: at }).where(eq(trainingMembers.id, id)).run());
  }

  async setNote(id: number, note: string | null): Promise<void> {
    await this.access(db => db.update(trainingMembers).set({ mentorNote: note }).where(eq(trainingMembers.id, id)).run());
  }

  async finishUninstall(id: number, at: Date): Promise<void> {
    await this.access(db => db.update(trainingMembers).set({ uninstalledAt: at }).where(eq(trainingMembers.id, id)).run());
  }
}
