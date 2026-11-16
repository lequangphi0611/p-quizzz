import { eq } from 'drizzle-orm';
import type { LeaderboardResponse } from '../../shared/api/index.js';
import { rankLeaderboard, totalScore } from '../../shared/scoring.js';
import type { Db } from '../db/client.js';
import { exams, participants, sessions } from '../db/schema.js';
import { ServiceError } from './errors.js';
import { countedAttempts } from './grading.js';

// docs/architecture.md §6: active participants with at least one submitted attempt, scored by their counted attempt.
export function buildLeaderboard(db: Db, sessionId: number): LeaderboardResponse {
  const session = db
    .select({ status: sessions.status, hasEssay: exams.hasEssay, totalPoints: exams.totalPoints })
    .from(sessions)
    .innerJoin(exams, eq(sessions.examId, exams.id))
    .where(eq(sessions.id, sessionId))
    .get();
  if (!session) throw new ServiceError(404, 'Không tìm thấy phiên');

  const names = new Map(db.select({ id: participants.id, name: participants.displayName }).from(participants).where(eq(participants.sessionId, sessionId)).all().map(p => [p.id, p.name]));
  const entries = [...countedAttempts(db, sessionId)].map(([pid, a]) => ({
    displayName: names.get(pid) ?? '',
    // PRODUCT §4.5: until the session is finalized only the automatic part counts; essay points the mentor has entered stay hidden.
    score: session.status === 'finalized' ? totalScore(a) : a.autoScore ?? 0,
    maxScore: session.totalPoints,
    submittedAt: a.submittedAt!.getTime(),
  }));
  return { provisional: session.status !== 'finalized', entries: rankLeaderboard(entries) };
}
