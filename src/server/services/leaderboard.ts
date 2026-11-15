import { and, eq, isNotNull } from 'drizzle-orm';
import type { LeaderboardResponse } from '../../shared/api/index.js';
import { pickCountedAttempt, rankLeaderboard, totalScore } from '../../shared/scoring.js';
import type { Db } from '../db/client.js';
import { attempts, exams, participants, sessions } from '../db/schema.js';
import { ServiceError } from './errors.js';

// docs/architecture.md §6: active participants with at least one submitted attempt, scored by their counted attempt.
export function buildLeaderboard(db: Db, sessionId: number): LeaderboardResponse {
  const session = db
    .select({ status: sessions.status, hasEssay: exams.hasEssay, totalPoints: exams.totalPoints })
    .from(sessions)
    .innerJoin(exams, eq(sessions.examId, exams.id))
    .where(eq(sessions.id, sessionId))
    .get();
  if (!session) throw new ServiceError(404, 'Không tìm thấy phiên');

  const rows = db
    .select({ name: participants.displayName, participantId: participants.id, attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active'), isNotNull(attempts.submittedAt)))
    .all();

  const byParticipant = new Map<number, { name: string; list: (typeof rows)[number]['attempt'][] }>();
  for (const r of rows) {
    const entry = byParticipant.get(r.participantId) ?? { name: r.name, list: [] };
    entry.list.push(r.attempt);
    byParticipant.set(r.participantId, entry);
  }

  const entries = [];
  for (const { name, list } of byParticipant.values()) {
    const counted = pickCountedAttempt(list.map(a => ({ id: a.id, submittedAt: a.submittedAt!.getTime(), score: totalScore(a) })), session.hasEssay);
    if (counted) entries.push({ displayName: name, score: counted.score, maxScore: session.totalPoints, submittedAt: counted.submittedAt! });
  }
  return { provisional: session.status !== 'finalized', entries: rankLeaderboard(entries) };
}
