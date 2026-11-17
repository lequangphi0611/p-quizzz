import { and, eq, inArray } from 'drizzle-orm';
import type { ParticipantProgress } from '../../../shared/api/index.js';
import { computeProgress, countAnswered, showsAnsweredCount } from '../../domain/attempt/attempt.js';
import type { Db } from './client.js';
import { answers, attempts, participants, sessions } from './schema.js';

/** Progress of every participant in a session, keyed by participant id: a few queries, then the domain rules. */
export function loadSessionProgress(db: Db, sessionId: number, exam: { totalPoints: number }): Map<number, ParticipantProgress> {
  const rows = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(eq(participants.sessionId, sessionId))
    .all()
    .map(r => r.attempt);
  const sessionStatus = db.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, sessionId)).get()?.status;
  const kickedIds = new Set(db.select({ id: participants.id }).from(participants).where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'kicked'))).all().map(p => p.id));
  // Only a running session shows the answered count, so other states (and use cases that load the detail for their own checks) skip reading answers.
  const openIds = showsAnsweredCount(sessionStatus) ? rows.filter(a => !a.submittedAt).map(a => a.id) : [];
  const answeredByAttempt = countAnswered(openIds.length === 0 ? [] : savedAnswers(db, openIds));
  return computeProgress(rows, { sessionStatus, kickedIds, totalPoints: exam.totalPoints, answeredByAttempt });
}

/** The answer columns of the given attempts, never scores. */
function savedAnswers(db: Db, attemptIds: number[]) {
  return db
    .select({ attemptId: answers.attemptId, selectedOptionIds: answers.selectedOptionIds, textAnswer: answers.textAnswer })
    .from(answers)
    .where(inArray(answers.attemptId, attemptIds))
    .all();
}
