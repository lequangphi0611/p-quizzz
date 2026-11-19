import { z } from 'zod';
import type { QuestionType } from '../exam-format/index.js';

// ⚠️ Member-facing DTOs. Until the session is closed they must never carry the answer key:
// no `isCorrect`, no `explanation`, no per-question scores. Always build these field by field — never
// return a database row (docs/architecture.md §5, "Quy tắc không lộ đáp án").

export const MAX_ESSAY_LENGTH = 10_000;
export const MAX_SELECTED_OPTIONS = 50;

export const MAX_EDIT_REASON_LENGTH = 500;

/** Longest reason on a `{reason}` question, after trimming (PRODUCT.md §7.32b). */
export const MAX_CHOICE_REASON_LENGTH = 200;

// Request to reopen the essay part of a submitted attempt (PRODUCT.md §7.21). `expired` = the session closed before the
// request was settled (derived when read, never stored).
export type EditRequestStatus = 'pending' | 'approved' | 'rejected' | 'done' | 'expired';

export interface EditRequestInfo {
  status: EditRequestStatus;
  reason: string;
  requestedAt: number; // epoch ms
  resolvedAt: number | null; // epoch ms the mentor answered (or the member finished editing); null while pending
}

// POST /api/me/attempts/:id/edit-request
export const EditRequestBody = z.object({
  reason: z.string({ error: 'Hãy ghi lý do xin sửa bài' }).trim().min(1, 'Hãy ghi lý do xin sửa bài').max(MAX_EDIT_REASON_LENGTH, 'Lý do tối đa 500 ký tự'),
});

export interface MemberOption {
  id: number;
  text: string;
}

export interface MemberQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  body: string;
  points: number; // how much the question is worth (shown as "2 điểm"), not what the member earned
  requireReason: boolean; // `{reason}`: once an option is picked, a short unscored reason is required (PRODUCT.md §7.32)
  options: MemberOption[]; // already in this attempt's shuffled order; empty for essay
}

export interface MemberAnswer {
  questionId: number;
  selectedOptionIds: number[] | null;
  textAnswer: string | null;
  reasonText: string | null; // the member's own reason on a `{reason}` question
}

// GET /api/me/attempts/:id — questions in this attempt's order, plus what the member has saved so far.
export interface AttemptView {
  id: number;
  attemptNo: number;
  startedAt: number; // epoch ms
  submittedAt: number | null;
  editRequest: EditRequestInfo | null; // `approved` on a submitted attempt = the essay questions can be edited again
  questions: MemberQuestion[];
  answers: MemberAnswer[];
}

// A submitted attempt. `score` is the automatic part only; `maxScore` is the most the automatic part can give
// (essay points are excluded until the mentor grades them). While the mentor holds scores back (PRODUCT.md §7.25),
// `score` and `essayScore` are null.
export interface AttemptSummary {
  id: number;
  attemptNo: number;
  submittedAt: number;
  score: number | null; // null = held back by the mentor
  maxScore: number;
  essayScore: number | null; // essay points graded so far (attempt total, not per question) (null = none graded yet, or held back); official once the session is finalized
  editRequest: EditRequestInfo | null;
  canRequestEdit: boolean; // session running, no pending/approved/finished request yet
}

export interface CurrentAttempt {
  id: number;
  attemptNo: number;
  startedAt: number;
}

// The attempt part of GET /api/me.
export interface MeAttemptState {
  current: CurrentAttempt | null;
  submitted: AttemptSummary[];
  canStartNew: boolean;
}

export interface SubmitResponse {
  attempt: AttemptSummary;
  essayPending: boolean; // true when the exam has essays still waiting for the mentor
}

// PUT /api/me/attempts/:id/answers/:questionId — send either `selectedOptionIds` (choice questions) or `textAnswer` (essay).
// `reasonText` goes with `selectedOptionIds`, only on a `{reason}` question; leaving it out keeps the saved reason.
export const SaveAnswerBody = z
  .object({
    selectedOptionIds: z.array(z.number().int().positive(), { error: 'Danh sách đáp án không hợp lệ' }).max(MAX_SELECTED_OPTIONS, 'Chọn quá nhiều đáp án').optional(),
    textAnswer: z.string({ error: 'Câu trả lời không hợp lệ' }).max(MAX_ESSAY_LENGTH, 'Câu trả lời tối đa 10.000 ký tự').optional(),
    reasonText: z.string({ error: 'Lý do không hợp lệ' }).trim().max(MAX_CHOICE_REASON_LENGTH, `Lý do tối đa ${MAX_CHOICE_REASON_LENGTH} ký tự`).optional(),
  })
  .refine(b => (b.selectedOptionIds === undefined) !== (b.textAnswer === undefined), 'Chỉ gửi selectedOptionIds hoặc textAnswer')
  .refine(b => b.reasonText === undefined || b.selectedOptionIds !== undefined, 'Lý do chỉ gửi kèm selectedOptionIds');

// 409 body of POST /api/me/attempts/:id/submit when the member submits with picks that still lack a reason (PRODUCT.md §7.32b).
export const REASON_MISSING_CODE = 'reason_missing';
export interface ReasonMissingError {
  error: string;
  code: typeof REASON_MISSING_CODE;
  questionIds: number[];
}

// ── Review (only after the session has closed) ──────────────────────────────────────────────────
// GET /api/me/attempts/:id/review. This is the one member DTO that carries the answer key; the server
// refuses it (403) until the session is `closed` or `finalized`.
export interface ReviewOption {
  id: number;
  text: string;
  isCorrect: boolean;
}

export interface ReviewQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null; // why (choice questions) or model answer / rubric (essay)
  options: ReviewOption[]; // in the order this member saw them
  selectedOptionIds: number[] | null;
  textAnswer: string | null;
  requireReason: boolean;
  reasonText: string | null; // this member's own reason (never someone else's)
  score: number | null; // choice: automatic score; essay: the mentor's score, null until graded
  feedback: string | null; // mentor's comment on an essay
  aiAssisted: boolean; // AI suggestions helped grade this essay; the score is still the mentor's (PRODUCT.md §7.28f)
}

// GET /api/admin/participants/:id/review — mentor only. `attempt` is null until the person has submitted.
export interface ParticipantReview {
  participant: { id: number; displayName: string; status: 'active' | 'pending' | 'kicked'; joinedAt: number };
  state: 'none' | 'doing' | 'submitted';
  attempt: ReviewView | null;
}

export interface ReviewView {
  attemptId: number;
  attemptNo: number;
  submittedAt: number;
  score: number; // automatic + manual points of this attempt so far
  maxScore: number; // exam total points
  official: boolean; // true once the session is finalized
  questions: ReviewQuestion[]; // in this member's attempt order
}
