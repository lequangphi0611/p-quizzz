import { randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { displayNameKey, type JoinResponse, type SessionParticipantInfo } from '../../shared/api/index.js';
import { ACTIVE_STATUSES } from '../../shared/session-state.js';
import type { Db } from '../db/client.js';
import { participants, sessions } from '../db/schema.js';
import { publish } from '../events.js';
import { ServiceError } from './errors.js';
import type { DbOrTx } from './sessions.js';

type ParticipantRow = typeof participants.$inferSelect;

// Public shape: never includes the token.
export const toParticipantInfo = (p: ParticipantRow): SessionParticipantInfo => ({
  id: p.id,
  displayName: p.displayName,
  status: p.status,
  joinedAt: p.joinedAt.getTime(),
});

const NAME_TAKEN = 'Tên đã có người dùng';

// SQLite's lower() is ASCII-only, so the unique index cannot catch "Đạt" vs "đạt". Compare in JS instead;
// the index stays as a backstop for the ASCII case (and is why we also map its violation below).
function assertNameFree(db: DbOrTx, sessionId: number, name: string, exceptId?: number) {
  const key = displayNameKey(name);
  const others = db
    .select({ id: participants.id, displayName: participants.displayName })
    .from(participants)
    .where(and(eq(participants.sessionId, sessionId), ne(participants.status, 'kicked')))
    .all();
  if (others.some(o => o.id !== exceptId && displayNameKey(o.displayName) === key)) throw new ServiceError(409, NAME_TAKEN);
}

const isUniqueViolation = (err: unknown) => err instanceof Error && 'code' in err && String(err.code).startsWith('SQLITE_CONSTRAINT');

// Runs `fn` in a transaction, turning a unique-index violation into the friendly 409.
function inTransaction<T>(db: Db, fn: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => T): T {
  try {
    return db.transaction(fn);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ServiceError(409, NAME_TAKEN);
    throw err;
  }
}

function getParticipant(db: DbOrTx, id: number): ParticipantRow {
  const p = db.select().from(participants).where(eq(participants.id, id)).get();
  if (!p) throw new ServiceError(404, 'Không tìm thấy người tham gia');
  return p;
}

const sameCode = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// `displayName` must already be normalized and `roomCode` digits-only (JoinBody does both).
export function joinSession(db: Db, sessionId: number, displayName: string, roomCode: string): JoinResponse {
  const token = randomBytes(32).toString('base64url');
  const row = inTransaction(db, tx => {
    const s = tx.select({ status: sessions.status, roomCode: sessions.roomCode }).from(sessions).where(eq(sessions.id, sessionId)).get();
    if (!s) throw new ServiceError(404, 'Không tìm thấy phiên');
    if (!ACTIVE_STATUSES.includes(s.status)) throw new ServiceError(409, 'Phiên thi không mở');
    // The only 403 joinSession throws: the route counts it towards the per-address limit.
    if (!s.roomCode || !sameCode(s.roomCode, roomCode)) throw new ServiceError(403, 'Mã phòng không đúng');
    assertNameFree(tx, sessionId, displayName);
    // In the lobby everyone is let in; once running, latecomers wait for the mentor (PRODUCT.md §7.7).
    const status = s.status === 'lobby' ? 'active' : 'pending';
    return tx.insert(participants).values({ sessionId, displayName, token, status, joinedAt: new Date() }).returning().get();
  });
  publish(sessionId, 'participants');
  return { token, participant: toParticipantInfo(row) };
}

export function renameParticipant(db: Db, id: number, displayName: string): SessionParticipantInfo {
  const row = inTransaction(db, tx => {
    const p = getParticipant(tx, id);
    if (p.status === 'kicked') throw new ServiceError(409, 'Người này đã bị mời ra khỏi phiên');
    assertNameFree(tx, p.sessionId, displayName, id);
    return tx.update(participants).set({ displayName }).where(eq(participants.id, id)).returning().get();
  });
  publish(row.sessionId, 'participants');
  publish(row.sessionId, 'leaderboard'); // the ranking shows names
  return toParticipantInfo(row);
}

// Kicking only flips the status. A kicked member's attempts are ignored everywhere (leaderboard, auto-submit,
// grading) because those only look at non-kicked participants; nothing is deleted.
export function kickParticipant(db: Db, id: number): SessionParticipantInfo {
  const row = db.transaction(tx => {
    const p = getParticipant(tx, id);
    if (p.status === 'kicked') throw new ServiceError(409, 'Người này đã bị mời ra khỏi phiên');
    return tx.update(participants).set({ status: 'kicked' }).where(eq(participants.id, id)).returning().get();
  });
  publish(row.sessionId, 'participants');
  publish(row.sessionId, 'leaderboard'); // a kicked member leaves the ranking
  return toParticipantInfo(row);
}

export function approveParticipant(db: Db, id: number): SessionParticipantInfo {
  const row = db.transaction(tx => {
    const p = getParticipant(tx, id);
    if (p.status !== 'pending') throw new ServiceError(409, 'Chỉ duyệt được người đang chờ duyệt');
    return tx.update(participants).set({ status: 'active' }).where(eq(participants.id, id)).returning().get();
  });
  publish(row.sessionId, 'participants');
  return toParticipantInfo(row);
}
