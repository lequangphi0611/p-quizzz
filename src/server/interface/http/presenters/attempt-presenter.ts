import type {
  AttemptSummary,
  AttemptView,
  MeResponse,
  MemberAnswer,
  MemberQuestion,
  ParticipantReview,
  ReviewQuestion,
  ReviewView,
  SubmitResponse,
} from '../../../../shared/api/index.js';
import { totalScore } from '../../../../shared/scoring.js';
import { canRequestEdit, toEditRequestInfo, type Attempt } from '../../../domain/attempt/attempt.js';
import type { ParticipantStatus } from '../../../domain/participant/participant.js';
import type { SessionStatus } from '../../../../shared/session-state.js';
import type { AttemptViewData, ReviewData } from '../../../application/use-cases/attempts/attempt-data.js';
import type { MemberState, ParticipantReviewResult } from '../../../application/use-cases/attempts/queries.js';
import type { SubmitResult } from '../../../application/use-cases/attempts/submit-attempt.js';
import { toParticipantInfoDto } from './participant-presenter.js';

// ⚠️ The only place where member-facing attempt DTOs are built. Field by field on purpose: handing over a domain
// object here would leak `isCorrect` / `explanation` while the session is still running (architecture.md §5).

export function toAttemptViewDto({ attempt, answers, exam, sessionStatus }: AttemptViewData): AttemptView {
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const questions: MemberQuestion[] = attempt.questionOrder.flatMap(qid => {
    const q = byId.get(qid);
    if (!q) return [];
    const optById = new Map(q.options.map(o => [o.id, o]));
    return [
      {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        body: q.body,
        points: q.points,
        options: (attempt.optionOrder[String(qid)] ?? []).flatMap(oid => (optById.has(oid) ? [{ id: oid, text: optById.get(oid)!.text }] : [])),
      },
    ];
  });
  const saved: MemberAnswer[] = answers.map(a => ({ questionId: a.questionId, selectedOptionIds: a.selectedOptionIds, textAnswer: a.textAnswer }));
  return {
    id: attempt.id,
    attemptNo: attempt.attemptNo,
    startedAt: attempt.startedAt.getTime(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.getTime() : null,
    editRequest: toEditRequestInfo(attempt, sessionStatus),
    questions,
    answers: saved,
  };
}

// `scoresHidden`: the mentor holds scores back (PRODUCT.md §7.25), so neither part of the score goes out.
const toSummary = (a: Attempt, maxScore: number, ctx: { sessionStatus: SessionStatus; participantStatus: ParticipantStatus; scoresHidden: boolean }): AttemptSummary => ({
  id: a.id,
  attemptNo: a.attemptNo,
  submittedAt: a.submittedAt!.getTime(),
  score: ctx.scoresHidden ? null : a.autoScore ?? 0,
  maxScore,
  essayScore: ctx.scoresHidden ? null : a.manualScore ?? null,
  editRequest: toEditRequestInfo(a, ctx.sessionStatus),
  canRequestEdit: canRequestEdit(a, ctx.sessionStatus, ctx.participantStatus),
});

export const toSubmitResponseDto = (r: SubmitResult): SubmitResponse => ({
  attempt: toSummary(r.attempt, r.maxScore, { sessionStatus: 'running', participantStatus: 'active', scoresHidden: r.scoresHidden }), // just submitted, so the session runs and the member is active
  essayPending: r.essayPending,
});

// ⚠️ Carries the answer key. Only call it with data the use case released (member after the close, or the mentor).
export function toReviewViewDto({ attempt, answers, exam, sessionStatus }: ReviewData): ReviewView {
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const saved = new Map(answers.map(a => [a.questionId, a]));
  const questions: ReviewQuestion[] = attempt.questionOrder.flatMap(qid => {
    const q = byId.get(qid);
    if (!q) return [];
    const a = saved.get(qid);
    const optById = new Map(q.options.map(o => [o.id, o]));
    return [
      {
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
      },
    ];
  });
  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    submittedAt: attempt.submittedAt!.getTime(), // callers only pass submitted attempts
    score: totalScore(attempt),
    maxScore: exam.totalPoints,
    official: sessionStatus === 'finalized',
    questions,
  };
}

export const toParticipantReviewDto = (r: ParticipantReviewResult): ParticipantReview => ({
  participant: toParticipantInfoDto(r.participant),
  state: r.state,
  attempt: r.review ? toReviewViewDto(r.review) : null,
});

export const toMeResponseDto = (m: MemberState): MeResponse => ({
  participant: toParticipantInfoDto(m.participant),
  session: { ...m.room, scoresHidden: m.scoresHidden, timer: m.timer, closedByTimer: m.closedByTimer },
  attempt: {
    current: m.current ? { id: m.current.id, attemptNo: m.current.attemptNo, startedAt: m.current.startedAt.getTime() } : null,
    submitted: m.submitted.map(a => toSummary(a, m.maxScore, { sessionStatus: m.room.status, participantStatus: m.participant.status, scoresHidden: m.scoresHidden })),
    canStartNew: m.canStartNew,
  },
});
