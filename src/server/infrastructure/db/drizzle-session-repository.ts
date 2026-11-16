import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { ACTIVE_STATUSES } from '../../../shared/session-state.js';
import type {
  ActiveSessionView,
  ScreenSessionView,
  SessionDetailView,
  SessionReader,
  SessionRepository,
  SessionSummaryView,
} from '../../application/ports/session-repository.js';
import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import { exams, participants, sessions } from './schema.js';
import { NO_PROGRESS } from '../../domain/attempt/attempt.js';
import { loadSessionProgress } from './session-progress.js';
import type { DbAccess } from './drizzle-exam-repository.js';

// Qualified names inside the subquery: drizzle would render a bare "id" that resolves to the wrong table.
const summaryColumns = {
  id: sessions.id,
  examId: sessions.examId,
  examTitle: exams.title,
  name: sessions.name,
  slot: sessions.slot,
  mode: sessions.mode,
  status: sessions.status,
  shuffle: sessions.shuffle,
  autoApprove: sessions.autoApprove,
  roomCode: sessions.roomCode,
  createdAt: sessions.createdAt,
  openedAt: sessions.openedAt,
  startedAt: sessions.startedAt,
  closedAt: sessions.closedAt,
  finalizedAt: sessions.finalizedAt,
  participantCount: sql<number>`(select count(*) from participants where participants.session_id = sessions.id and participants.status = 'active')`,
};

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<Session | null> {
    return (await this.access(db => db.select().from(sessions).where(eq(sessions.id, id)).get())) ?? null;
  }

  create(s: NewSession): Promise<number> {
    return this.access(
      db =>
        db
          .insert(sessions)
          .values({ examId: s.examId, name: s.name, mode: s.mode, shuffle: s.shuffle, autoApprove: s.autoApprove, createdAt: s.createdAt })
          .returning({ id: sessions.id })
          .get().id,
    );
  }

  async update(id: number, patch: SessionPatch): Promise<void> {
    await this.access(db => db.update(sessions).set(patch).where(eq(sessions.id, id)).run());
  }

  async lowestFreeSlot(): Promise<number> {
    const used = new Set(
      (await this.access(db => db.select({ slot: sessions.slot }).from(sessions).where(inArray(sessions.status, [...ACTIVE_STATUSES])).all())).map(r => r.slot),
    );
    let slot = 1;
    while (used.has(slot)) slot++;
    return slot;
  }

  async roomCodeInUse(code: string): Promise<boolean> {
    return !!(await this.access(db => db.select({ id: sessions.id }).from(sessions).where(eq(sessions.roomCode, code)).get()));
  }
}

export class DrizzleSessionReader implements SessionReader {
  constructor(private readonly access: DbAccess) {}

  async exists(id: number): Promise<boolean> {
    return !!(await this.access(db => db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id)).get()));
  }

  list(): Promise<SessionSummaryView[]> {
    return this.access(db =>
      db.select(summaryColumns).from(sessions).innerJoin(exams, eq(sessions.examId, exams.id)).orderBy(desc(sessions.createdAt), desc(sessions.id)).all(),
    );
  }

  findDetail(id: number): Promise<SessionDetailView | null> {
    return this.access(db => {
      const row = db.select(summaryColumns).from(sessions).innerJoin(exams, eq(sessions.examId, exams.id)).where(eq(sessions.id, id)).get();
      if (!row) return null;
      const exam = db.select({ id: exams.id, title: exams.title, hasEssay: exams.hasEssay, totalPoints: exams.totalPoints }).from(exams).where(eq(exams.id, row.examId)).get()!;
      const people = db
        .select({ id: participants.id, displayName: participants.displayName, status: participants.status, joinedAt: participants.joinedAt })
        .from(participants)
        .where(eq(participants.sessionId, id))
        .orderBy(participants.id)
        .all();
      const progress = loadSessionProgress(db, id, exam.totalPoints);
      return { ...row, exam, participants: people.map(p => ({ ...p, progress: progress.get(p.id) ?? NO_PROGRESS(exam.totalPoints) })) };
    });
  }

  listActive(): Promise<SessionSummaryView[]> {
    return this.access(db =>
      db
        .select(summaryColumns)
        .from(sessions)
        .innerJoin(exams, eq(sessions.examId, exams.id))
        .where(inArray(sessions.status, [...ACTIVE_STATUSES]))
        .orderBy(asc(sessions.slot), asc(sessions.id))
        .all(),
    );
  }

  async findPublic(id: number): Promise<ActiveSessionView | null> {
    return (await this.access(db => this.publicRows(db).where(eq(sessions.id, id)).get())) ?? null;
  }

  async findOpenByRoomCode(code: string): Promise<ActiveSessionView | null> {
    return (await this.access(db => this.publicRows(db).where(and(eq(sessions.roomCode, code), inArray(sessions.status, [...ACTIVE_STATUSES]))).get())) ?? null;
  }

  async findOpenRoomCode(id: number): Promise<string | null> {
    const row = await this.access(db =>
      db.select({ roomCode: sessions.roomCode }).from(sessions).where(and(eq(sessions.id, id), inArray(sessions.status, [...ACTIVE_STATUSES]))).get(),
    );
    return row?.roomCode ?? null;
  }

  listScreenSessions(): Promise<ScreenSessionView[]> {
    return this.access(db =>
      this.screenRows(db).where(inArray(sessions.status, [...ACTIVE_STATUSES])).orderBy(asc(sessions.slot), asc(sessions.id)).all(),
    );
  }

  async findLatestEnded(): Promise<ScreenSessionView | null> {
    return (await this.access(db => this.screenRows(db).where(inArray(sessions.status, ['closed', 'finalized'])).orderBy(desc(sessions.id)).get())) ?? null;
  }

  private publicRows(db: Parameters<Parameters<DbAccess>[0]>[0]) {
    return db.select({ id: sessions.id, title: exams.title, status: sessions.status }).from(sessions).innerJoin(exams, eq(sessions.examId, exams.id));
  }

  private screenRows(db: Parameters<Parameters<DbAccess>[0]>[0]) {
    return db
      .select({ id: sessions.id, name: sessions.name, slot: sessions.slot, title: exams.title, status: sessions.status })
      .from(sessions)
      .innerJoin(exams, eq(sessions.examId, exams.id));
  }
}
