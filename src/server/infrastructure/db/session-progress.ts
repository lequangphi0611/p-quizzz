import { and, count, eq, inArray } from 'drizzle-orm';
import type { ParticipantProgress } from '../../../shared/api/index.js';
import { isAnswered } from '../../../shared/answered.js';
import { computeProgress } from '../../domain/attempt/attempt.js';
import type { Db } from './client.js';
import { answers, attempts, participants, questions, sessions } from './schema.js';

/** Progress of every participant in a session, keyed by participant id (plus the exam's question count): a few queries, then the domain rule. */
export function loadSessionProgress(db: Db, sessionId: number, exam: { id: number; totalPoints: number }): { byParticipant: Map<number, ParticipantProgress>; questionCount: number } {
  const rows = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(eq(participants.sessionId, sessionId))
    .all()
    .map(r => r.attempt);
  const sessionStatus = db.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, sessionId)).get()?.status;
  const kickedIds = new Set(db.select({ id: participants.id }).from(participants).where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'kicked'))).all().map(p => p.id));
  const questionCount = db.select({ n: count() }).from(questions).where(eq(questions.examId, exam.id)).get()?.n ?? 0;
  const answeredByAttempt = answeredInOpenAttempts(db, rows.filter(a => !a.submittedAt).map(a => a.id));
  return { byParticipant: computeProgress(rows, { sessionStatus, kickedIds, totalPoints: exam.totalPoints, questionCount, answeredByAttempt }), questionCount };
}

/** How many questions each open attempt has answered. Reads only the answer columns, never scores. */
function answeredInOpenAttempts(db: Db, attemptIds: number[]): Map<number, number> {
  const result = new Map<number, number>();
  if (attemptIds.length === 0) return result;
  const saved = db
    .select({ attemptId: answers.attemptId, selectedOptionIds: answers.selectedOptionIds, textAnswer: answers.textAnswer })
    .from(answers)
    .where(inArray(answers.attemptId, attemptIds))
    .all();
  for (const a of saved) if (isAnswered(a)) result.set(a.attemptId, (result.get(a.attemptId) ?? 0) + 1);
  return result;
}
