import { z } from 'zod';
import type { QuestionType } from '../exam-format/index.js';

// ⚠️ Member-facing DTOs. Until the session is closed they must never carry the answer key:
// no `isCorrect`, no `explanation`, no per-question scores. Always build these field by field — never
// return a database row (docs/architecture.md §5, "Quy tắc không lộ đáp án").

export const MAX_ESSAY_LENGTH = 10_000;
export const MAX_SELECTED_OPTIONS = 50;

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
  options: MemberOption[]; // already in this attempt's shuffled order; empty for essay
}

export interface MemberAnswer {
  questionId: number;
  selectedOptionIds: number[] | null;
  textAnswer: string | null;
}

// GET /api/me/attempts/:id — questions in this attempt's order, plus what the member has saved so far.
export interface AttemptView {
  id: number;
  attemptNo: number;
  startedAt: number; // epoch ms
  submittedAt: number | null;
  questions: MemberQuestion[];
  answers: MemberAnswer[];
}

// A submitted attempt. `score` is the automatic part only; `maxScore` is the most the automatic part can give
// (essay points are excluded until the mentor grades them).
export interface AttemptSummary {
  id: number;
  attemptNo: number;
  submittedAt: number;
  score: number;
  maxScore: number;
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
export const SaveAnswerBody = z
  .object({
    selectedOptionIds: z.array(z.number().int().positive(), { error: 'Danh sách đáp án không hợp lệ' }).max(MAX_SELECTED_OPTIONS, 'Chọn quá nhiều đáp án').optional(),
    textAnswer: z.string({ error: 'Câu trả lời không hợp lệ' }).max(MAX_ESSAY_LENGTH, 'Câu trả lời tối đa 10.000 ký tự').optional(),
  })
  .refine(b => (b.selectedOptionIds === undefined) !== (b.textAnswer === undefined), 'Chỉ gửi selectedOptionIds hoặc textAnswer');
