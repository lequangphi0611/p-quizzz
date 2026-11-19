import { MAX_CHOICE_REASON_LENGTH, type EditRequestInfo, type ParticipantProgress } from '../../../shared/api/index.js';
import { isAnswered, isMissingReason } from '../../../shared/answered.js';
import { pickCountedAttempt, scoreAnswer, totalScore } from '../../../shared/scoring.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { Exam, Question } from '../exam/exam.js';
import type { ParticipantStatus } from '../participant/participant.js';
import { shuffled, type RandomInt } from '../shuffle.js';
import {
  AlreadyAttemptedError,
  AnswersNotYetVisibleError,
  AttemptAlreadySubmittedError,
  AttemptInProgressError,
  AttemptNotSubmittedError,
  AwaitingApprovalError,
  EditLockedError,
  EditRequestNotAllowedError,
  InvalidAnswerError,
  NoPendingEditRequestError,
  ReasonMissingError,
  SessionNotRunningError,
} from './errors.js';

export interface Attempt {
  id: number;
  participantId: number;
  attemptNo: number;
  /** Question ids in the order this member sees them. Fixed when the attempt starts, so F5 never reshuffles. */
  questionOrder: number[];
  /** Option ids per question id (as a string key), in the order this member sees them. */
  optionOrder: Record<string, number[]>;
  startedAt: Date;
  submittedAt: Date | null;
  autoScore: number | null;
  manualScore: number | null;
  /** Request to reopen the essay part after submitting (PRODUCT.md §7.21). Null = never asked. */
  editStatus: EditStatus | null;
  editReason: string | null;
  editRequestedAt: Date | null;
  editResolvedAt: Date | null;
}

export type EditStatus = 'pending' | 'approved' | 'rejected' | 'done';

export interface Answer {
  id: number;
  attemptId: number;
  questionId: number;
  selectedOptionIds: number[] | null;
  textAnswer: string | null;
  /** Reason on a `{reason}` question (PRODUCT.md §7.32); never scored. */
  reasonText: string | null;
  autoScore: number | null;
  manualScore: number | null;
  feedback: string | null;
  gradedAt: Date | null;
}

export type NewAttempt = Pick<Attempt, 'participantId' | 'attemptNo' | 'questionOrder' | 'optionOrder' | 'startedAt'>;

export const NO_EDIT_REQUEST = { editStatus: null, editReason: null, editRequestedAt: null, editResolvedAt: null } as const;

export type AnswerInput = { selectedOptionIds?: number[]; textAnswer?: string; reasonText?: string };

// ── Rules (pure: use cases load the facts) ──────────────────────────────────────────────────────

/** Starting needs a running session and an approved member, and every member gets exactly one attempt per session. */
export function assertCanStart(facts: { sessionStatus: SessionStatus; participantStatus: ParticipantStatus; existing: Pick<Attempt, 'submittedAt'>[] }): void {
  if (facts.sessionStatus !== 'running') throw new SessionNotRunningError('Phiên thi chưa bắt đầu hoặc đã đóng');
  if (facts.participantStatus !== 'active') throw new AwaitingApprovalError();
  if (facts.existing.some(a => !a.submittedAt)) throw new AttemptInProgressError();
  // One attempt per participant per session, for every exam. To retake, the mentor opens a new session.
  if (facts.existing.length > 0) throw new AlreadyAttemptedError();
}

/** Question and option order for a new attempt: shuffled per member when the session shuffles, else the exam's own order. */
export function planOrder(exam: Pick<Exam, 'questions'>, shuffle: boolean, randomInt: RandomInt) {
  const questions = shuffle ? shuffled(exam.questions, randomInt) : exam.questions;
  const optionOrder: Record<string, number[]> = {};
  for (const q of exam.questions) {
    const ids = q.options.map(o => o.id);
    optionOrder[String(q.id)] = shuffle ? shuffled(ids, randomInt) : ids;
  }
  return { questionOrder: questions.map(q => q.id), optionOrder };
}

/** Work can be saved or submitted only on an unsubmitted attempt while the session runs. */
export function assertCanWork(attempt: Pick<Attempt, 'submittedAt'>, sessionStatus: SessionStatus): void {
  if (attempt.submittedAt) throw new AttemptAlreadySubmittedError();
  if (sessionStatus !== 'running') throw new SessionNotRunningError();
}

/**
 * Saving an answer: normally only on an unsubmitted attempt while the session runs. The one exception is a submitted
 * attempt whose edit request the mentor approved: then only essay answers can change (PRODUCT.md §7.21).
 */
export function assertCanSaveAnswer(attempt: Pick<Attempt, 'submittedAt' | 'editStatus'>, sessionStatus: SessionStatus, questionType: Question['type'] | undefined): void {
  if (attempt.submittedAt && attempt.editStatus === 'approved') {
    if (sessionStatus !== 'running') throw new SessionNotRunningError();
    if (questionType !== undefined && questionType !== 'essay') throw new EditLockedError();
    return;
  }
  assertCanWork(attempt, sessionStatus);
}

/** Asking to edit the essays: member is active, attempt submitted, session running, and no request is open or already granted. */
export function assertCanRequestEdit(facts: { attempt: Pick<Attempt, 'submittedAt' | 'editStatus'>; sessionStatus: SessionStatus; participantStatus: ParticipantStatus }): void {
  if (facts.sessionStatus !== 'running') throw new SessionNotRunningError('Chỉ xin sửa bài khi phiên đang chạy');
  if (facts.participantStatus !== 'active') throw new AwaitingApprovalError();
  if (!facts.attempt.submittedAt) throw new AttemptNotSubmittedError();
  if (facts.attempt.editStatus === 'pending') throw new EditRequestNotAllowedError('Bạn đã gửi yêu cầu, hãy chờ mentor trả lời');
  if (facts.attempt.editStatus === 'approved' || facts.attempt.editStatus === 'done') throw new EditRequestNotAllowedError('Mỗi bài chỉ được mở lại để sửa một lần');
}

/** The mentor settles a pending request while the session is still running. */
export function assertCanResolveEdit(attempt: Pick<Attempt, 'editStatus'>, sessionStatus: SessionStatus | undefined): void {
  if (sessionStatus !== 'running') throw new SessionNotRunningError('Phiên đã đóng, yêu cầu sửa bài hết hiệu lực');
  if (attempt.editStatus !== 'pending') throw new NoPendingEditRequestError();
}

/** The member ends an approved editing window. */
export function assertCanFinishEdit(attempt: Pick<Attempt, 'editStatus'>): void {
  if (attempt.editStatus !== 'approved') throw new EditRequestNotAllowedError('Bài này chưa được mở lại để sửa');
}

/** The request as clients see it: one that was never settled before the session closed reads as `expired`. */
export function toEditRequestInfo(attempt: Pick<Attempt, 'editStatus' | 'editReason' | 'editRequestedAt' | 'editResolvedAt'>, sessionStatus: SessionStatus | undefined): EditRequestInfo | null {
  if (!attempt.editStatus || !attempt.editRequestedAt) return null;
  const open = attempt.editStatus === 'pending' || attempt.editStatus === 'approved';
  return { status: open && sessionStatus !== 'running' ? 'expired' : attempt.editStatus, reason: attempt.editReason ?? '', requestedAt: attempt.editRequestedAt.getTime(), resolvedAt: attempt.editResolvedAt ? attempt.editResolvedAt.getTime() : null };
}

/** The member may send a (new) request: a rejected one can be retried. */
export const canRequestEdit = (attempt: Pick<Attempt, 'submittedAt' | 'editStatus'>, sessionStatus: SessionStatus, participantStatus: ParticipantStatus): boolean =>
  sessionStatus === 'running' && participantStatus === 'active' && !!attempt.submittedAt && (attempt.editStatus === null || attempt.editStatus === 'rejected');

/** The answer to store for `question`, or `InvalidAnswerError` (400). Duplicate option ids are dropped. */
export function validateAnswer(
  attempt: Pick<Attempt, 'questionOrder'>,
  question: { id: number; type: Question['type']; optionIds: number[]; requireReason: boolean } | null,
  questionId: number,
  input: AnswerInput,
) {
  if (!attempt.questionOrder.includes(questionId) || !question) throw new InvalidAnswerError('Câu hỏi không thuộc lượt làm bài này');
  if (input.reasonText !== undefined && !question.requireReason) throw new InvalidAnswerError('Câu này không hỏi lý do');
  if (question.type === 'essay') {
    if (input.textAnswer === undefined) throw new InvalidAnswerError('Câu tự luận cần textAnswer');
    return { textAnswer: input.textAnswer };
  }
  if (input.selectedOptionIds === undefined) throw new InvalidAnswerError('Câu trắc nghiệm cần selectedOptionIds');
  const selected = [...new Set(input.selectedOptionIds)];
  const valid = new Set(question.optionIds);
  if (!selected.every(id => valid.has(id))) throw new InvalidAnswerError('Đáp án không thuộc câu hỏi này');
  if (question.type === 'single' && selected.length > 1) throw new InvalidAnswerError('Câu một đáp án chỉ được chọn tối đa 1');
  if (input.reasonText === undefined) return { selectedOptionIds: selected };
  const reasonText = input.reasonText.trim();
  if (reasonText.length > MAX_CHOICE_REASON_LENGTH) throw new InvalidAnswerError(`Lý do tối đa ${MAX_CHOICE_REASON_LENGTH} ký tự`);
  return { selectedOptionIds: selected, reasonText };
}

/** Question ids (in the member's order) that have a pick but no reason on a `{reason}` question (PRODUCT.md §7.32b). */
export function missingReasons(exam: Pick<Exam, 'questions'>, order: readonly number[], saved: readonly Pick<Answer, 'questionId' | 'selectedOptionIds' | 'reasonText'>[]): number[] {
  const byQuestion = new Map(saved.map(a => [a.questionId, a]));
  const questions = new Map(exam.questions.map(q => [q.id, q]));
  return order.filter(id => {
    const q = questions.get(id);
    return q !== undefined && isMissingReason(q, byQuestion.get(id));
  });
}

/** A member's own submit is refused while a picked `{reason}` question has no reason. Closing the session or the clock running out never checks this. */
export function assertReasonsComplete(missing: readonly number[]): void {
  if (missing.length > 0) throw new ReasonMissingError(missing);
}

/**
 * Scores an attempt from its saved answers. Every question gets an entry (blank ones included, so review and manual
 * grading always have an answer to point at); essays score `null` until a mentor grades them.
 */
export function gradeAttempt(exam: Pick<Exam, 'questions'>, saved: Pick<Answer, 'questionId' | 'selectedOptionIds'>[]) {
  const byQuestion = new Map(saved.map(a => [a.questionId, a]));
  const scores = exam.questions.map(q => ({
    questionId: q.id,
    autoScore: scoreAnswer({ type: q.type, points: q.points, options: q.options }, byQuestion.get(q.id)?.selectedOptionIds),
  }));
  return { scores, autoScore: scores.reduce((sum, s) => sum + (s.autoScore ?? 0), 0) };
}

/** Most the automatic part can give: every non-essay question. */
export const maxAutoScore = (exam: Pick<Exam, 'questions'>): number => exam.questions.filter(q => q.type !== 'essay').reduce((sum, q) => sum + q.points, 0);

/** Answers (with the key) are shown only from CLOSED onward, and only for a submitted attempt. */
export function assertReviewable(attempt: Pick<Attempt, 'submittedAt'>, sessionStatus: SessionStatus): void {
  if (sessionStatus !== 'closed' && sessionStatus !== 'finalized') throw new AnswersNotYetVisibleError();
  if (!attempt.submittedAt) throw new AttemptNotSubmittedError();
}

export const isSessionOver = (status: SessionStatus | undefined): boolean => status === 'closed' || status === 'finalized';

/** The mentor's view of one person's attempt state. A kicked member's open attempt is never auto-submitted, so it is not "doing" once the session is over. */
export function reviewState(attempts: Pick<Attempt, 'submittedAt'>[], participantStatus: ParticipantStatus, sessionStatus: SessionStatus): 'none' | 'doing' | 'submitted' {
  if (attempts.some(a => a.submittedAt)) return 'submitted';
  const doing = attempts.length > 0 && !(participantStatus === 'kicked' && isSessionOver(sessionStatus));
  return doing ? 'doing' : 'none';
}

/** What the member's own screen needs about their attempts. */
export function memberAttemptState(facts: { attempts: Attempt[]; sessionStatus: SessionStatus; participantStatus: ParticipantStatus }) {
  const current = facts.attempts.find(a => !a.submittedAt) ?? null;
  const submitted = facts.attempts.filter(a => a.submittedAt);
  const canStartNew = facts.sessionStatus === 'running' && facts.participantStatus === 'active' && facts.attempts.length === 0; // one attempt per session
  return { current, submitted, canStartNew };
}

export const NO_PROGRESS = (totalPoints: number): ParticipantProgress => ({ state: 'none', attempts: 0, countedScore: null, maxScore: totalPoints, submittedAt: null, editRequest: null, answered: null });

/** The answered count (PRODUCT.md §7.26) is worth reading only while the session runs: it is shown nowhere else. */
export const showsAnsweredCount = (status: SessionStatus | undefined): boolean => status === 'running';

/** How many questions each attempt has answered, from its saved answers (PRODUCT.md §7.26). Never looks at correctness. */
export function countAnswered(saved: readonly Pick<Answer, 'attemptId' | 'selectedOptionIds' | 'textAnswer'>[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const a of saved) if (isAnswered(a)) result.set(a.attemptId, (result.get(a.attemptId) ?? 0) + 1);
  return result;
}

/**
 * Progress of every participant who has an attempt, keyed by participant id. Official (manual) points count only once finalized.
 * `answeredByAttempt` holds how many questions each open attempt has answered (PRODUCT.md §7.26); it is reported only while
 * the session runs and the person is "doing".
 */
export function computeProgress(
  attempts: Attempt[],
  facts: { sessionStatus: SessionStatus | undefined; kickedIds: Set<number>; totalPoints: number; answeredByAttempt: ReadonlyMap<number, number> },
): Map<number, ParticipantProgress> {
  const byParticipant = new Map<number, Attempt[]>();
  for (const a of attempts) byParticipant.set(a.participantId, [...(byParticipant.get(a.participantId) ?? []), a]);

  const over = isSessionOver(facts.sessionStatus);
  const result = new Map<number, ParticipantProgress>();
  for (const [pid, list] of byParticipant) {
    const counted = pickCountedAttempt(
      list.map(a => ({ id: a.id, submittedAt: a.submittedAt ? a.submittedAt.getTime() : null, score: facts.sessionStatus === 'finalized' ? totalScore(a) : a.autoScore ?? 0 })),
    );
    const open = list.find(a => !a.submittedAt);
    const doing = open !== undefined && !(over && facts.kickedIds.has(pid));
    result.set(pid, {
      state: doing ? 'doing' : list.some(a => a.submittedAt) ? 'submitted' : 'none',
      attempts: list.length,
      countedScore: counted ? counted.score : null,
      maxScore: facts.totalPoints,
      submittedAt: counted ? counted.submittedAt : null,
      editRequest: toEditRequestInfo(list.find(a => a.id === counted?.id) ?? { editStatus: null, editReason: null, editRequestedAt: null, editResolvedAt: null }, facts.sessionStatus),
      answered: doing && showsAnsweredCount(facts.sessionStatus) ? facts.answeredByAttempt.get(open.id) ?? 0 : null,
    });
  }
  return result;
}
