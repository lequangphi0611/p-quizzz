import { and, eq } from 'drizzle-orm';
import type { ParticipantProgress } from '../../../shared/api/index.js';
import { computeProgress } from '../../domain/attempt/attempt.js';
import type { Db } from '../../db/client.js';
import { attempts, participants, sessions } from '../../db/schema.js';

/** Progress of every participant in a session, keyed by participant id: three queries, then the domain rule. */
export function loadSessionProgress(db: Db, sessionId: number, totalPoints: number): Map<number, ParticipantProgress> {
  const rows = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(eq(participants.sessionId, sessionId))
    .all()
    .map(r => r.attempt);
  const sessionStatus = db.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, sessionId)).get()?.status;
  const kickedIds = new Set(db.select({ id: participants.id }).from(participants).where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'kicked'))).all().map(p => p.id));
  return computeProgress(rows, { sessionStatus, kickedIds, totalPoints });
}
