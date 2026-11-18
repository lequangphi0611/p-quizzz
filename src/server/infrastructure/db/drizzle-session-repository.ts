import { and, asc, desc, eq, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { ACTIVE_STATUSES } from '../../../shared/session-state.js';
import type {
  ActiveSessionView,
  LobbyHeadcount,
  ScreenSessionView,
  SessionDetailView,
  SessionReader,
  SessionRepository,
  SessionSummaryView,
} from '../../application/ports/session-repository.js';
import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import type { Headcount } from '../../domain/session/start.js';
import { exams, participants, rejoinRequests, sessionRoster, sessions } from './schema.js';
import type { RosterSource } from '../../../shared/api/index.js';
import { NO_PROGRESS } from '../../domain/attempt/attempt.js';
import { examQuestionCount } from './question-count.js';
import { loadSessionProgress } from './session-progress.js';
import type { DbAccess } from './drizzle-exam-repository.js';

const activeCount = sql<number>`(select count(*) from participants where participants.session_id = sessions.id and participants.status = 'active')`;
const readyCount = sql<number>`(select count(*) from participants where participants.session_id = sessions.id and participants.status = 'active' and participants.ready_at is not null)`;
const pendingCount = sql<number>`(select count(*) from participants where participants.session_id = sessions.id and participants.status = 'pending')`;

// Qualified names inside the subquery: drizzle would render a bare "id" that resolves to the wrong table.
const summaryColumns = {
  id: sessions.id,
  examId: sessions.examId,
  examTitle: exams.title,
  name: sessions.name,
  slot: sessions.slot,
  access: sessions.access,
  outsiderPolicy: sessions.outsiderPolicy,
  // "group" once the list is (or was saved as) a saved group; "temp" while it only lives in this session.
  rosterSource: sql<RosterSource | null>`case when sessions.source_group_id is not null then 'group' when sessions.access = 'roster' then 'temp' else null end`,
  mode: sessions.mode,
  status: sessions.status,
  shuffle: sessions.shuffle,
  autoApprove: sessions.autoApprove,
  scoreVisibility: sessions.scoreVisibility,
  scoresReleasedAt: sessions.scoresReleasedAt,
  timeLimitMinutes: sessions.timeLimitMinutes,
  endsAt: sessions.endsAt,
  scheduledStartAt: sessions.scheduledStartAt,
  countdownEndsAt: sessions.countdownEndsAt,
  countdownSource: sessions.countdownSource,
  autoStartReady: sessions.autoStartReady,
  readyMin: sessions.readyMin,
  startScheduleDroppedAt: sessions.startScheduleDroppedAt,
  roomCode: sessions.roomCode,
  createdAt: sessions.createdAt,
  openedAt: sessions.openedAt,
  startedAt: sessions.startedAt,
  closedAt: sessions.closedAt,
  finalizedAt: sessions.finalizedAt,
  participantCount: activeCount,
  readyCount,
  pendingCount,
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
          .values({ examId: s.examId, name: s.name, mode: s.mode, shuffle: s.shuffle, autoApprove: s.autoApprove, access: s.access, outsiderPolicy: s.outsiderPolicy, sourceGroupId: s.sourceGroupId, scoreVisibility: s.scoreVisibility, timeLimitMinutes: s.timeLimitMinutes, createdAt: s.createdAt })
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

  async addRoster(sessionId: number, emails: readonly string[]): Promise<number> {
    return this.access(db => {
      const have = new Set(db.select({ email: sessionRoster.email }).from(sessionRoster).where(eq(sessionRoster.sessionId, sessionId)).all().map(r => r.email));
      let position = have.size;
      let added = 0;
      for (const email of emails) {
        if (have.has(email)) continue;
        db.insert(sessionRoster).values({ sessionId, email, position: position++ }).run();
        have.add(email);
        added++;
      }
      return added;
    });
  }

  async rosterEmails(sessionId: number): Promise<string[]> {
    return (await this.access(db => db.select({ email: sessionRoster.email }).from(sessionRoster).where(eq(sessionRoster.sessionId, sessionId)).orderBy(asc(sessionRoster.position)).all())).map(r => r.email);
  }

  async hasRosterEmail(sessionId: number, email: string): Promise<boolean> {
    return !!(await this.access(db => db.select({ id: sessionRoster.id }).from(sessionRoster).where(and(eq(sessionRoster.sessionId, sessionId), eq(sessionRoster.email, email))).get()));
  }

  async setSourceGroup(sessionId: number, groupId: number): Promise<void> {
    await this.access(db => db.update(sessions).set({ sourceGroupId: groupId }).where(eq(sessions.id, sessionId)).run());
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
      const exam = db.select({ id: exams.id, title: exams.title, hasEssay: exams.hasEssay, totalPoints: exams.totalPoints, questionCount: examQuestionCount }).from(exams).where(eq(exams.id, row.examId)).get()!;
      const people = db
        .select({ id: participants.id, displayName: participants.displayName, status: participants.status, joinedAt: participants.joinedAt, readyAt: participants.readyAt, email: participants.email, rejoinAllowedUntil: participants.rejoinAllowedUntil })
        .from(participants)
        .where(eq(participants.sessionId, id))
        .orderBy(participants.id)
        .all();
      const progress = loadSessionProgress(db, id, exam);
      return { ...row, exam, participants: people.map(p => ({ ...p, progress: progress.get(p.id) ?? NO_PROGRESS(exam.totalPoints) })), roster: row.access === 'roster' ? rosterOf(db, id) : null, rejoinRequests: rejoinRequestsOf(db, id, row.status) };
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

  async listRunningIdsEndedBy(cutoff: Date): Promise<number[]> {
    const rows = await this.access(db =>
      db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.status, 'running'), lte(sessions.endsAt, cutoff))).all(),
    );
    return rows.map(r => r.id);
  }

  async listLobbyIdsWithStartPlan(): Promise<number[]> {
    const rows = await this.access(db =>
      db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.status, 'lobby'), or(isNotNull(sessions.scheduledStartAt), isNotNull(sessions.countdownEndsAt), eq(sessions.autoStartReady, true))))
        .all(),
    );
    return rows.map(r => r.id);
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

  async rosterCounts(sessionId: number): Promise<{ joinedCount: number; rosterSize: number } | null> {
    return this.access(db => {
      const s = db.select({ access: sessions.access }).from(sessions).where(eq(sessions.id, sessionId)).get();
      if (!s || s.access !== 'roster') return null;
      const r = rosterOf(db, sessionId);
      return { joinedCount: r.joined, rosterSize: r.size };
    });
  }

  private publicRows(db: Parameters<Parameters<DbAccess>[0]>[0]) {
    return db
      .select({
        id: sessions.id, title: exams.title, status: sessions.status, access: sessions.access, timeLimitMinutes: sessions.timeLimitMinutes, endsAt: sessions.endsAt,
        scheduledStartAt: sessions.scheduledStartAt,
        countdownEndsAt: sessions.countdownEndsAt,
        countdownSource: sessions.countdownSource,
        autoStartReady: sessions.autoStartReady,
        readyMin: sessions.readyMin,
        participantCount: activeCount, readyCount,
      })
      .from(sessions)
      .innerJoin(exams, eq(sessions.examId, exams.id));
  }

  private screenRows(db: Parameters<Parameters<DbAccess>[0]>[0]) {
    return db
      .select({ id: sessions.id, name: sessions.name, slot: sessions.slot, title: exams.title, status: sessions.status })
      .from(sessions)
      .innerJoin(exams, eq(sessions.examId, exams.id));
  }
}

type Db = Parameters<Parameters<DbAccess>[0]>[0];

/** The list of a roster session: how many emails, how many have someone in (not kicked), and the ones still missing. */
function rosterOf(db: Db, sessionId: number): { size: number; joined: number; notJoined: string[] } {
  const emails = db.select({ email: sessionRoster.email }).from(sessionRoster).where(eq(sessionRoster.sessionId, sessionId)).orderBy(asc(sessionRoster.position)).all().map(r => r.email);
  const present = new Set(
    db.select({ email: participants.email }).from(participants).where(and(eq(participants.sessionId, sessionId), ne(participants.status, 'kicked'))).all().map(r => r.email),
  );
  const notJoined = emails.filter(e => !present.has(e));
  return { size: emails.length, joined: emails.length - notJoined.length, notJoined };
}

/** Requests still waiting to take over a seat in this session; none once the session is no longer open (they expired). */
function rejoinRequestsOf(db: Db, sessionId: number, status: string): { id: number; participantId: number; claimantName: string; requestedAt: Date }[] {
  if (!ACTIVE_STATUSES.includes(status as never)) return [];
  return db
    .select({ id: rejoinRequests.id, participantId: rejoinRequests.participantId, claimantName: rejoinRequests.claimantName, requestedAt: rejoinRequests.createdAt })
    .from(rejoinRequests)
    .innerJoin(participants, eq(rejoinRequests.participantId, participants.id))
    .where(and(eq(participants.sessionId, sessionId), eq(rejoinRequests.status, 'pending')))
    .orderBy(asc(rejoinRequests.id))
    .all();
}

/** Counts in the lobby for "everyone ready" (PRODUCT.md §7.31e), and the mark of who was there at the start (§7.31f). */
export class DrizzleLobbyHeadcount implements LobbyHeadcount {
  constructor(private readonly access: DbAccess) {}

  count(sessionId: number): Promise<Headcount> {
    return this.access(db => {
      const rows = db.select({ status: participants.status, readyAt: participants.readyAt }).from(participants).where(eq(participants.sessionId, sessionId)).all();
      const active = rows.filter(r => r.status === 'active');
      return { total: active.length, ready: active.filter(r => r.readyAt !== null).length, pending: rows.filter(r => r.status === 'pending').length };
    });
  }

  async markPresentAtStart(sessionId: number): Promise<void> {
    await this.access(db => db.update(participants).set({ presentAtStart: true }).where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active'))).run());
  }
}
