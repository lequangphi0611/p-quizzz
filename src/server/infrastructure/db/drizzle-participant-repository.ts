import { and, eq, ne } from 'drizzle-orm';
import type { ParticipantReader, ParticipantRepository } from '../../application/ports/participant-repository.js';
import { NameTakenError } from '../../domain/participant/errors.js';
import type { NewParticipant, Participant, ParticipantStatus } from '../../domain/participant/participant.js';
import { participants } from './schema.js';
import type { DbAccess } from './drizzle-exam-repository.js';

// Only the display-name index counts as a name clash; any other constraint failure (token, foreign key...) is a real bug.
const isNameViolation = (err: unknown) =>
  err instanceof Error && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE' && err.message.includes('participants_session_name_uq');

export class DrizzleParticipantRepository implements ParticipantRepository, ParticipantReader {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<Participant | null> {
    return (await this.access(db => db.select().from(participants).where(eq(participants.id, id)).get())) ?? null;
  }

  async findByToken(token: string): Promise<Participant | null> {
    if (!token) return null;
    return (await this.access(db => db.select().from(participants).where(eq(participants.token, token)).get())) ?? null;
  }

  namesOf(sessionId: number) {
    return this.access(db => db.select({ id: participants.id, displayName: participants.displayName }).from(participants).where(eq(participants.sessionId, sessionId)).all());
  }

  listNotKicked(sessionId: number) {
    return this.access(db =>
      db
        .select({ id: participants.id, displayName: participants.displayName })
        .from(participants)
        .where(and(eq(participants.sessionId, sessionId), ne(participants.status, 'kicked')))
        .all(),
    );
  }

  listActiveNames(sessionId: number) {
    return this.access(db =>
      db
        .select({ displayName: participants.displayName })
        .from(participants)
        .where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active')))
        .orderBy(participants.joinedAt, participants.id)
        .all(),
    );
  }

  // SQLite's lower() is ASCII-only, so the unique index cannot catch "Đạt" vs "đạt" (the domain rule does);
  // the index stays as a backstop for the ASCII case, and its violation becomes the friendly name clash.
  async add(p: NewParticipant): Promise<Participant> {
    try {
      return await this.access(db => db.insert(participants).values(p).returning().get());
    } catch (err) {
      if (isNameViolation(err)) throw new NameTakenError();
      throw err;
    }
  }

  async update(id: number, patch: { displayName?: string; status?: ParticipantStatus }): Promise<Participant> {
    try {
      return await this.access(db => db.update(participants).set(patch).where(eq(participants.id, id)).returning().get());
    } catch (err) {
      if (isNameViolation(err)) throw new NameTakenError();
      throw err;
    }
  }
}
