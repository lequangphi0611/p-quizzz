import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { ActiveSession, SessionDetail, SessionSummary } from '../../shared/api/index.js';
import {
  ACTIVE_STATUSES,
  nextStatus,
  SESSION_ACTION_VERB,
  SESSION_STATUS_LABEL,
  type SessionAction,
} from '../../shared/session-state.js';
import type { Db } from '../db/client.js';
import { exams, participants, sessions } from '../db/schema.js';
import { publish } from '../events.js';
import { ServiceError } from './errors.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;


// ── Hooks implemented by later stories ──────────────────────────────────────────────────────────
/**
 * Runs inside the close transaction, before the status changes.
 * TODO(S11): submit every unsubmitted attempt with its saved answers (auto-grading included).
 * Skip participants with status 'kicked': a kicked member's attempts never count (S08).
 */
export function onSessionClosing(_db: DbOrTx, _sessionId: number): void {}

/**
 * Whether `finalize` may proceed.
 * TODO(S15): true only when every essay answer of each counted attempt has a manual score.
 */
export function canFinalize(_db: DbOrTx, _sessionId: number): boolean {
  return true;
}
// ────────────────────────────────────────────────────────────────────────────────────────────────

// Qualified names inside the subquery: drizzle would render a bare "id" that resolves to the wrong table.
const summaryColumns = {
  id: sessions.id,
  examId: sessions.examId,
  examTitle: exams.title,
  mode: sessions.mode,
  status: sessions.status,
  shuffle: sessions.shuffle,
  createdAt: sessions.createdAt,
  openedAt: sessions.openedAt,
  startedAt: sessions.startedAt,
  closedAt: sessions.closedAt,
  finalizedAt: sessions.finalizedAt,
  participantCount: sql<number>`(select count(*) from participants where participants.session_id = sessions.id and participants.status = 'active')`,
};

type SummaryRow = Omit<SessionSummary, 'createdAt' | 'openedAt' | 'startedAt' | 'closedAt' | 'finalizedAt'> & {
  createdAt: Date;
  openedAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  finalizedAt: Date | null;
};

const ms = (d: Date | null) => (d ? d.getTime() : null);
const toSummary = (r: SummaryRow): SessionSummary => ({
  ...r,
  createdAt: r.createdAt.getTime(),
  openedAt: ms(r.openedAt),
  startedAt: ms(r.startedAt),
  closedAt: ms(r.closedAt),
  finalizedAt: ms(r.finalizedAt),
});

const selectSummary = (db: DbOrTx) => db.select(summaryColumns).from(sessions).innerJoin(exams, eq(sessions.examId, exams.id));

export function createSession(db: Db, input: { examId: number; shuffle?: boolean }): SessionDetail {
  const exam = db.select({ id: exams.id }).from(exams).where(eq(exams.id, input.examId)).get();
  if (!exam) throw new ServiceError(404, 'Không tìm thấy đề');
  const row = db
    .insert(sessions)
    .values({ examId: input.examId, mode: 'self_paced', shuffle: input.shuffle ?? true, createdAt: new Date() })
    .returning({ id: sessions.id })
    .get();
  return getSessionDetail(db, row.id);
}

export function listSessions(db: Db): SessionSummary[] {
  return selectSummary(db).orderBy(desc(sessions.createdAt), desc(sessions.id)).all().map(toSummary);
}

export function getSessionDetail(db: DbOrTx, id: number): SessionDetail {
  const row = selectSummary(db).where(eq(sessions.id, id)).get();
  if (!row) throw new ServiceError(404, 'Không tìm thấy phiên');
  const exam = db.select({ id: exams.id, title: exams.title, hasEssay: exams.hasEssay, totalPoints: exams.totalPoints }).from(exams).where(eq(exams.id, row.examId)).get()!;
  const people = db
    .select({ id: participants.id, displayName: participants.displayName, status: participants.status, joinedAt: participants.joinedAt })
    .from(participants)
    .where(eq(participants.sessionId, id))
    .orderBy(participants.id)
    .all()
    .map(p => ({ ...p, joinedAt: p.joinedAt.getTime() }));
  return { ...toSummary(row), exam, participants: people };
}

export function getActiveSession(db: Db): ActiveSession | null {
  const row = db
    .select({ id: sessions.id, title: exams.title, status: sessions.status })
    .from(sessions)
    .innerJoin(exams, eq(sessions.examId, exams.id))
    .where(inArray(sessions.status, [...ACTIVE_STATUSES]))
    .orderBy(desc(sessions.id))
    .get();
  return row ?? null;
}

// Applies a lifecycle action atomically, stamps the matching timestamp(s), then signals SSE listeners.
export function transitionSession(db: Db, id: number, action: SessionAction): SessionDetail {
  db.transaction(tx => {
    const s = tx.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!s) throw new ServiceError(404, 'Không tìm thấy phiên');

    const next = nextStatus(s.status, action);
    if (!next) {
      throw new ServiceError(409, `Không thể ${SESSION_ACTION_VERB[action]} khi phiên đang ở trạng thái "${SESSION_STATUS_LABEL[s.status]}"`);
    }

    const now = new Date();
    const patch: Partial<typeof sessions.$inferInsert> = { status: next };

    if (action === 'open') {
      // At most one session in lobby/running (PRODUCT.md §7.5). The transaction makes check-and-set atomic.
      const other = tx.select({ id: sessions.id }).from(sessions).where(and(inArray(sessions.status, [...ACTIVE_STATUSES]), ne(sessions.id, id))).get();
      if (other) throw new ServiceError(409, 'Đang có phiên thi khác hoạt động');
      patch.openedAt = now;
    } else if (action === 'start') {
      patch.startedAt = now;
    } else if (action === 'close') {
      onSessionClosing(tx, id);
      patch.closedAt = now;
      const exam = tx.select({ hasEssay: exams.hasEssay }).from(exams).where(eq(exams.id, s.examId)).get()!;
      if (!exam.hasEssay) {
        // Nothing to grade by hand: the session is final right away.
        patch.status = 'finalized';
        patch.finalizedAt = now;
      }
    } else {
      if (!canFinalize(tx, id)) throw new ServiceError(409, 'Còn câu tự luận chưa chấm điểm');
      patch.finalizedAt = now;
    }

    tx.update(sessions).set(patch).where(eq(sessions.id, id)).run();
  });

  publish(id, 'session');
  return getSessionDetail(db, id);
}
