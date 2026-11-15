import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type {
  AttemptSummary,
  AttemptView,
  MeAttemptState,
  MemberAnswer,
  MemberQuestion,
  ParticipantProgress,
  ReviewQuestion,
  ReviewView,
  SubmitResponse,
} from '../../shared/api/index.js';
import { pickCountedAttempt, scoreAnswer, totalScore } from '../../shared/scoring.js';
import type { Db } from '../db/client.js';
import { answers, attempts, exams, options, participants, questions, sessions } from '../db/schema.js';
import { publish } from '../events.js';
import { ServiceError } from './errors.js';
import { shuffled } from './shuffle.js';
import type { DbOrTx } from './sessions.js';

type QuestionRow = typeof questions.$inferSelect;
type OptionRow = typeof options.$inferSelect;
type AttemptRow = typeof attempts.$inferSelect;
type ParticipantRow = typeof participants.$inferSelect;

interface ExamContent {
  questions: QuestionRow[]; // by position
  optionsByQuestion: Map<number, OptionRow[]>; // by position
}

function loadExamContent(db: DbOrTx, examId: number): ExamContent {
  const qs = db.select().from(questions).where(eq(questions.examId, examId)).orderBy(asc(questions.position)).all();
  const os = qs.length ? db.select().from(options).where(inArray(options.questionId, qs.map(q => q.id))).orderBy(asc(options.position)).all() : [];
  const optionsByQuestion = new Map<number, OptionRow[]>();
  for (const o of os) optionsByQuestion.set(o.questionId, [...(optionsByQuestion.get(o.questionId) ?? []), o]);
  return { questions: qs, optionsByQuestion };
}

// Most the automatic part can give: every non-essay question.
const maxAutoScore = (c: ExamContent) => c.questions.filter(q => q.type !== 'essay').reduce((s, q) => s + q.points, 0);

const ms = (d: Date) => d.getTime();

function toSummary(a: AttemptRow, maxScore: number): AttemptSummary {
  return { id: a.id, attemptNo: a.attemptNo, submittedAt: ms(a.submittedAt!), score: a.autoScore ?? 0, maxScore };
}

function getOwnedAttempt(db: DbOrTx, participantId: number, attemptId: number): AttemptRow {
  const a = db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.participantId, participantId))).get();
  // Someone else's attempt looks exactly like a missing one.
  if (!a) throw new ServiceError(404, 'Không tìm thấy lượt làm bài');
  return a;
}

function getSession(db: DbOrTx, sessionId: number) {
  return db.select().from(sessions).where(eq(sessions.id, sessionId)).get()!;
}

// ── Grading ─────────────────────────────────────────────────────────────────────────────────────
// Marks the attempt submitted and scores it. Every question gets an `answers` row (blank ones included) so that
// review and manual grading (S15) always have something to point at. Used by Submit and by closing the session.
function gradeAndSubmit(db: DbOrTx, attempt: AttemptRow, content: ExamContent, now: Date) {
  const saved = new Map(db.select().from(answers).where(eq(answers.attemptId, attempt.id)).all().map(a => [a.questionId, a]));
  let auto = 0;
  for (const q of content.questions) {
    const opts = (content.optionsByQuestion.get(q.id) ?? []).map(o => ({ id: o.id, isCorrect: o.isCorrect }));
    const existing = saved.get(q.id);
    const score = scoreAnswer({ type: q.type, points: q.points, options: opts }, existing?.selectedOptionIds);
    if (score !== null) auto += score;
    if (existing) db.update(answers).set({ autoScore: score }).where(eq(answers.id, existing.id)).run();
    else db.insert(answers).values({ attemptId: attempt.id, questionId: q.id, autoScore: score }).run();
  }
  db.update(attempts).set({ submittedAt: now, autoScore: auto }).where(eq(attempts.id, attempt.id)).run();
  return { ...attempt, submittedAt: now, autoScore: auto };
}

/**
 * Hook called by closing a session (S06): submits and scores every unfinished attempt with its saved answers.
 * A kicked member's attempts are left alone — they never count. Returns how many were submitted.
 */
export function autoSubmitOpenAttempts(db: DbOrTx, sessionId: number): number {
  const open = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(and(eq(participants.sessionId, sessionId), isNull(attempts.submittedAt), eq(participants.status, 'active')))
    .all();
  if (open.length === 0) return 0;
  const examId = getSession(db, sessionId).examId;
  const content = loadExamContent(db, examId);
  const now = new Date();
  for (const { attempt } of open) gradeAndSubmit(db, attempt, content, now);
  return open.length;
}

// ── Member-facing views ─────────────────────────────────────────────────────────────────────────
function buildView(db: DbOrTx, attempt: AttemptRow, content: ExamContent): AttemptView {
  const byId = new Map(content.questions.map(q => [q.id, q]));
  // Field-by-field on purpose: a DB row here would leak `isCorrect` / `explanation`.
  const qs: MemberQuestion[] = attempt.questionOrder.flatMap(qid => {
    const q = byId.get(qid);
    if (!q) return [];
    const optById = new Map((content.optionsByQuestion.get(qid) ?? []).map(o => [o.id, o]));
    const order = attempt.optionOrder[String(qid)] ?? [];
    return [{
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      body: q.body,
      points: q.points,
      options: order.flatMap(oid => (optById.has(oid) ? [{ id: oid, text: optById.get(oid)!.text }] : [])),
    }];
  });
  const saved: MemberAnswer[] = db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, attempt.id))
    .all()
    .map(a => ({ questionId: a.questionId, selectedOptionIds: a.selectedOptionIds, textAnswer: a.textAnswer }));
  return { id: attempt.id, attemptNo: attempt.attemptNo, startedAt: ms(attempt.startedAt), submittedAt: attempt.submittedAt ? ms(attempt.submittedAt) : null, questions: qs, answers: saved };
}

export function getAttemptView(db: Db, participant: ParticipantRow, attemptId: number): AttemptView {
  const attempt = getOwnedAttempt(db, participant.id, attemptId);
  const content = loadExamContent(db, getSession(db, participant.sessionId).examId);
  return buildView(db, attempt, content);
}

// ⚠️ Carries the answer key. Refused until the session has closed, so a member who can still retake the exam
// can never read it.
export function getAttemptReview(db: Db, participant: ParticipantRow, attemptId: number): ReviewView {
  const attempt = getOwnedAttempt(db, participant.id, attemptId);
  const session = getSession(db, participant.sessionId);
  if (session.status !== 'closed' && session.status !== 'finalized') throw new ServiceError(403, 'Đáp án sẽ hiện khi phiên thi kết thúc');
  if (!attempt.submittedAt) throw new ServiceError(409, 'Lượt này chưa được nộp');

  const content = loadExamContent(db, session.examId);
  const byId = new Map(content.questions.map(q => [q.id, q]));
  const saved = new Map(db.select().from(answers).where(eq(answers.attemptId, attempt.id)).all().map(a => [a.questionId, a]));

  const qs: ReviewQuestion[] = attempt.questionOrder.flatMap(qid => {
    const q = byId.get(qid);
    if (!q) return [];
    const a = saved.get(qid);
    const optById = new Map((content.optionsByQuestion.get(qid) ?? []).map(o => [o.id, o]));
    return [{
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      body: q.body,
      points: q.points,
      explanation: q.explanation,
      options: (attempt.optionOrder[String(qid)] ?? []).flatMap(oid => (optById.has(oid) ? [{ id: oid, text: optById.get(oid)!.text, isCorrect: optById.get(oid)!.isCorrect }] : [])),
      selectedOptionIds: a?.selectedOptionIds ?? null,
      textAnswer: a?.textAnswer ?? null,
      score: q.type === 'essay' ? a?.manualScore ?? null : a?.autoScore ?? 0,
      feedback: q.type === 'essay' ? a?.feedback ?? null : null,
    }];
  });
  const exam = db.select({ totalPoints: exams.totalPoints }).from(exams).where(eq(exams.id, session.examId)).get()!;
  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    submittedAt: ms(attempt.submittedAt),
    score: totalScore(attempt),
    maxScore: exam.totalPoints,
    official: session.status === 'finalized',
    questions: qs,
  };
}

// The attempt block of GET /api/me.
export function getMeAttemptState(db: Db, participant: ParticipantRow): MeAttemptState {
  const session = getSession(db, participant.sessionId);
  const exam = db.select({ hasEssay: exams.hasEssay }).from(exams).where(eq(exams.id, session.examId)).get()!;
  const max = maxAutoScore(loadExamContent(db, session.examId));
  const mine = db.select().from(attempts).where(eq(attempts.participantId, participant.id)).orderBy(asc(attempts.attemptNo)).all();
  const current = mine.find(a => !a.submittedAt) ?? null;
  const submitted = mine.filter(a => a.submittedAt).map(a => toSummary(a, max));
  const canStartNew = session.status === 'running' && participant.status === 'active' && !current && (!exam.hasEssay || submitted.length === 0);
  return {
    current: current ? { id: current.id, attemptNo: current.attemptNo, startedAt: ms(current.startedAt) } : null,
    submitted,
    canStartNew,
  };
}

// ── Member actions ──────────────────────────────────────────────────────────────────────────────
export function startAttempt(db: Db, participantId: number): AttemptView {
  const view = db.transaction(tx => {
    const participant = tx.select().from(participants).where(eq(participants.id, participantId)).get()!;
    const session = getSession(tx, participant.sessionId);
    if (session.status !== 'running') throw new ServiceError(409, 'Phiên thi chưa bắt đầu hoặc đã đóng');
    if (participant.status !== 'active') throw new ServiceError(409, 'Bạn đang chờ mentor duyệt');

    const mine = tx.select().from(attempts).where(eq(attempts.participantId, participantId)).all();
    if (mine.some(a => !a.submittedAt)) throw new ServiceError(409, 'Bạn đang có một lượt làm dở');
    const exam = tx.select({ hasEssay: exams.hasEssay }).from(exams).where(eq(exams.id, session.examId)).get()!;
    if (exam.hasEssay && mine.length > 0) throw new ServiceError(409, 'Đề có tự luận chỉ được làm 1 lần');

    // The order is fixed here, per attempt; a retake is shuffled again (PRODUCT.md §7.8).
    const content = loadExamContent(tx, session.examId);
    const ordered = session.shuffle ? shuffled(content.questions) : content.questions;
    const optionOrder: Record<string, number[]> = {};
    for (const q of content.questions) {
      const ids = (content.optionsByQuestion.get(q.id) ?? []).map(o => o.id);
      optionOrder[String(q.id)] = session.shuffle ? shuffled(ids) : ids;
    }
    const attempt = tx
      .insert(attempts)
      .values({
        participantId,
        attemptNo: mine.reduce((m, a) => Math.max(m, a.attemptNo), 0) + 1,
        questionOrder: ordered.map(q => q.id),
        optionOrder,
        startedAt: new Date(),
      })
      .returning()
      .get();
    return { view: buildView(tx, attempt, content), sessionId: session.id };
  });
  publish(view.sessionId, 'participants'); // the mentor's progress column changes
  return view.view;
}

export type SaveAnswerInput = { selectedOptionIds?: number[]; textAnswer?: string };

export function saveAnswer(db: Db, participantId: number, attemptId: number, questionId: number, input: SaveAnswerInput): void {
  db.transaction(tx => {
    const attempt = getOwnedAttempt(tx, participantId, attemptId);
    if (attempt.submittedAt) throw new ServiceError(409, 'Lượt này đã nộp');
    const participant = tx.select().from(participants).where(eq(participants.id, participantId)).get()!;
    if (getSession(tx, participant.sessionId).status !== 'running') throw new ServiceError(409, 'Phiên thi đã đóng');

    if (!attempt.questionOrder.includes(questionId)) throw new ServiceError(400, 'Câu hỏi không thuộc lượt làm bài này');
    const q = tx.select().from(questions).where(eq(questions.id, questionId)).get()!;

    if (q.type === 'essay') {
      if (input.textAnswer === undefined) throw new ServiceError(400, 'Câu tự luận cần textAnswer');
      tx.insert(answers)
        .values({ attemptId, questionId, textAnswer: input.textAnswer })
        .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { textAnswer: input.textAnswer } })
        .run();
      return;
    }

    if (input.selectedOptionIds === undefined) throw new ServiceError(400, 'Câu trắc nghiệm cần selectedOptionIds');
    const selected = [...new Set(input.selectedOptionIds)];
    const valid = new Set(tx.select({ id: options.id }).from(options).where(eq(options.questionId, questionId)).all().map(o => o.id));
    if (!selected.every(id => valid.has(id))) throw new ServiceError(400, 'Đáp án không thuộc câu hỏi này');
    if (q.type === 'single' && selected.length > 1) throw new ServiceError(400, 'Câu một đáp án chỉ được chọn tối đa 1');
    tx.insert(answers)
      .values({ attemptId, questionId, selectedOptionIds: selected })
      .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { selectedOptionIds: selected } })
      .run();
  });
}

export function submitAttempt(db: Db, participantId: number, attemptId: number): SubmitResponse {
  const out = db.transaction(tx => {
    const attempt = getOwnedAttempt(tx, participantId, attemptId);
    if (attempt.submittedAt) throw new ServiceError(409, 'Lượt này đã nộp');
    const participant = tx.select().from(participants).where(eq(participants.id, participantId)).get()!;
    const session = getSession(tx, participant.sessionId);
    if (session.status !== 'running') throw new ServiceError(409, 'Phiên thi đã đóng');

    const content = loadExamContent(tx, session.examId);
    const done = gradeAndSubmit(tx, attempt, content, new Date());
    const hasEssay = content.questions.some(q => q.type === 'essay');
    return { sessionId: session.id, response: { attempt: toSummary(done, maxAutoScore(content)), essayPending: hasEssay } };
  });
  publish(out.sessionId, 'leaderboard');
  publish(out.sessionId, 'participants');
  return out.response;
}

// ── Mentor view ─────────────────────────────────────────────────────────────────────────────────
// Progress of every participant in a session, keyed by participant id.
export function getSessionProgress(db: DbOrTx, sessionId: number, hasEssay: boolean, totalPoints: number): Map<number, ParticipantProgress> {
  const rows = db
    .select({ attempt: attempts })
    .from(attempts)
    .innerJoin(participants, eq(attempts.participantId, participants.id))
    .where(eq(participants.sessionId, sessionId))
    .all();
  const byParticipant = new Map<number, AttemptRow[]>();
  for (const { attempt } of rows) byParticipant.set(attempt.participantId, [...(byParticipant.get(attempt.participantId) ?? []), attempt]);

  const result = new Map<number, ParticipantProgress>();
  for (const [pid, list] of byParticipant) {
    const counted = pickCountedAttempt(list.map(a => ({ id: a.id, submittedAt: a.submittedAt ? ms(a.submittedAt) : null, score: totalScore(a) })), hasEssay);
    const doing = list.some(a => !a.submittedAt);
    result.set(pid, {
      state: doing ? 'doing' : 'submitted',
      attempts: list.length,
      countedScore: counted ? counted.score : null,
      maxScore: totalPoints,
    });
  }
  return result;
}

export const NO_PROGRESS = (totalPoints: number): ParticipantProgress => ({ state: 'none', attempts: 0, countedScore: null, maxScore: totalPoints });
