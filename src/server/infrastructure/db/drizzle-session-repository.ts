import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ACTIVE_STATUSES } from '../../../shared/session-state.js';
import type {
  ActiveSessionView,
  SessionDetailView,
  SessionReader,
  SessionRepository,
  SessionSummaryView,
  UngradedEssayCounter,
} from '../../application/ports/session-repository.js';
import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import { exams, participants, sessions } from '../../db/schema.js';
import { NO_PROGRESS } from '../../domain/attempt/attempt.js';
import { loadSessionProgress } from './session-progress.js';
import { countUngradedEssays } from '../../services/grading.js';
import type { DbAccess } from './drizzle-exam-repository.js';

// Qualified names inside the subquery: drizzle would render a bare "id" that resolves to the wrong table.
const summaryColumns = {
  id: sessions.id,
  examId: sessions.examId,
  examTitle: exams.title,
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
          .values({ examId: s.examId, mode: s.mode, shuffle: s.shuffle, autoApprove: s.autoApprove, createdAt: s.createdAt })
          .returning({ id: sessions.id })
          .get().id,
    );
  }

  async update(id: number, patch: SessionPatch): Promise<void> {
    await this.access(db => db.update(sessions).set(patch).where(eq(sessions.id, id)).run());
  }

  async hasActiveOtherThan(id: number): Promise<boolean> {
    const other = await this.access(db =>
      db.select({ id: sessions.id }).from(sessions).where(and(inArray(sessions.status, [...ACTIVE_STATUSES]), ne(sessions.id, id))).get(),
    );
    return !!other;
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

  async findActive(): Promise<ActiveSessionView | null> {
    return (await this.access(db => this.pick(db, [...ACTIVE_STATUSES]))) ?? null;
  }

  async findLatest(): Promise<ActiveSessionView | null> {
    return (await this.access(db => this.pick(db, [...ACTIVE_STATUSES]) ?? this.pick(db, ['closed', 'finalized']))) ?? null;
  }

  private pick(db: Parameters<Parameters<DbAccess>[0]>[0], statuses: Session['status'][]) {
    return db
      .select({ id: sessions.id, title: exams.title, status: sessions.status })
      .from(sessions)
      .innerJoin(exams, eq(sessions.examId, exams.id))
      .where(inArray(sessions.status, statuses))
      .orderBy(desc(sessions.id))
      .get();
  }
}

/** Bridge to the legacy grading service. P3-4 replaces it. */
export class LegacyUngradedEssayCounter implements UngradedEssayCounter {
  constructor(private readonly access: DbAccess) {}

  count(sessionId: number): Promise<number> {
    return this.access(db => countUngradedEssays(db, sessionId));
  }
}
