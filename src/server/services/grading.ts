import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { GradeResponse, GradingAnswer, GradingQuestion, GradingView } from '../../shared/api/index.js';
import { pickCountedAttempt, totalScore } from '../../shared/scoring.js';
import type { Db } from '../db/client.js';
import { answers, attempts, exams, participants, questions, sessions } from '../db/schema.js';
import { publish } from '../events.js';
import { ServiceError } from './errors.js';
import type { DbOrTx } from './sessions.js';

type AttemptRow = typeof attempts.$inferSelect;

// The attempt of each active participant that counts: their single submitted attempt
// (kicked members and people who never submitted have none).
function countedAttempts(db: DbOrTx, sessionId: number): Map<number, AttemptRow> {
  const rows = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active'), isNotNull(attempts.submittedAt)))
    .all();
  const byParticipant = new Map<number, AttemptRow[]>();
  for (const { attempt } of rows) byParticipant.set(attempt.participantId, [...(byParticipant.get(attempt.participantId) ?? []), attempt]);
  const out = new Map<number, AttemptRow>();
  for (const [pid, list] of byParticipant) {
    const pick = pickCountedAttempt(list.map(a => ({ id: a.id, submittedAt: a.submittedAt!.getTime(), score: totalScore(a), row: a })));
    if (pick) out.set(pid, pick.row);
  }
  return out;
}

function sessionInfo(db: DbOrTx, sessionId: number) {
  const s = db
    .select({ status: sessions.status, hasEssay: exams.hasEssay, examId: exams.id })
    .from(sessions)
    .innerJoin(exams, eq(sessions.examId, exams.id))
    .where(eq(sessions.id, sessionId))
    .get();
  if (!s) throw new ServiceError(404, 'Không tìm thấy phiên');
  return s;
}

const ESSAY_ROWS = (db: DbOrTx, attemptIds: number[]) =>
  attemptIds.length === 0
    ? []
    : db
        .select({ answer: answers, question: questions })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(and(inArray(answers.attemptId, attemptIds), eq(questions.type, 'essay')))
        .all();

/**
 * Essay answers (of counted attempts) still waiting for a score. A blank answer needs a score too (usually 0).
 * This is what blocks `finalize` (S06 calls it from the transition).
 */
export function countUngradedEssays(db: DbOrTx, sessionId: number): number {
  const info = sessionInfo(db, sessionId);
  const counted = [...countedAttempts(db, sessionId).values()];
  return ESSAY_ROWS(db, counted.map(a => a.id)).filter(r => r.answer.manualScore === null).length;
}

const toAnswer = (a: typeof answers.$inferSelect, participantId: number, displayName: string): GradingAnswer => ({
  answerId: a.id,
  participantId,
  displayName,
  textAnswer: a.textAnswer,
  manualScore: a.manualScore,
  feedback: a.feedback,
});

// Everything the grading screen shows: each essay question with the counted answers of every active member.
export function getGradingView(db: Db, sessionId: number): GradingView {
  const info = sessionInfo(db, sessionId);
  if (info.status !== 'closed' && info.status !== 'finalized') throw new ServiceError(409, 'Chỉ chấm được sau khi đóng phiên');

  const counted = countedAttempts(db, sessionId);
  const byAttempt = new Map([...counted.entries()].map(([pid, a]) => [a.id, pid]));
  const names = new Map(db.select({ id: participants.id, name: participants.displayName }).from(participants).where(eq(participants.sessionId, sessionId)).all().map(p => [p.id, p.name]));
  const rows = ESSAY_ROWS(db, [...byAttempt.keys()]);

  const essayQuestions = db.select().from(questions).where(and(eq(questions.examId, info.examId), eq(questions.type, 'essay'))).orderBy(questions.position).all();
  const out: GradingQuestion[] = essayQuestions.map(q => ({
    id: q.id,
    position: q.position,
    prompt: q.prompt,
    body: q.body,
    points: q.points,
    explanation: q.explanation,
    answers: rows
      .filter(r => r.question.id === q.id)
      .map(r => { const pid = byAttempt.get(r.answer.attemptId)!; return toAnswer(r.answer, pid, names.get(pid) ?? ''); })
      .sort((a, b) => a.participantId - b.participantId),
  }));
  const all = out.flatMap(q => q.answers);
  return { sessionId, status: info.status, graded: all.filter(a => a.manualScore !== null).length, total: all.length, questions: out };
}

export function gradeAnswer(db: Db, answerId: number, input: { score: number; feedback?: string }): GradeResponse {
  const result = db.transaction(tx => {
    const row = tx
      .select({ answer: answers, question: questions, attempt: attempts, participant: participants })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(attempts, eq(answers.attemptId, attempts.id))
      .innerJoin(participants, eq(attempts.participantId, participants.id))
      .where(eq(answers.id, answerId))
      .get();
    if (!row) throw new ServiceError(404, 'Không tìm thấy bài làm');
    if (row.question.type !== 'essay') throw new ServiceError(400, 'Chỉ chấm tay được câu tự luận');

    const session = sessionInfo(tx, row.participant.sessionId);
    if (session.status === 'finalized') throw new ServiceError(409, 'Phiên đã chốt kết quả, không sửa điểm được');
    if (session.status !== 'closed') throw new ServiceError(409, 'Chỉ chấm được sau khi đóng phiên');
    if (row.participant.status !== 'active') throw new ServiceError(409, 'Người này đã bị mời ra khỏi phiên');
    if (!row.attempt.submittedAt) throw new ServiceError(409, 'Bài này chưa được nộp');

    const max = row.question.points;
    if (input.score > max) throw new ServiceError(400, `Điểm phải từ 0 đến ${String(max).replace('.', ',')}`);

    const feedback = input.feedback?.trim() ? input.feedback.trim() : null;
    const updated = tx.update(answers).set({ manualScore: input.score, feedback, gradedAt: new Date() }).where(eq(answers.id, answerId)).returning().get();

    // The attempt's manual total is always recomputed from its graded answers, so regrading never double-counts.
    const sum = tx.select({ s: answers.manualScore }).from(answers).where(and(eq(answers.attemptId, row.attempt.id), isNotNull(answers.manualScore))).all().reduce((t, r) => t + (r.s ?? 0), 0);
    tx.update(attempts).set({ manualScore: sum }).where(eq(attempts.id, row.attempt.id)).run();

    const ungraded = countUngradedEssays(tx, row.participant.sessionId);
    const total = ESSAY_ROWS(tx, [...countedAttempts(tx, row.participant.sessionId).values()].map(a => a.id)).length;
    return { sessionId: row.participant.sessionId, answer: toAnswer(updated, row.participant.id, row.participant.displayName), graded: total - ungraded, total };
  });
  publish(result.sessionId, 'leaderboard');
  return { answer: result.answer, graded: result.graded, total: result.total };
}
