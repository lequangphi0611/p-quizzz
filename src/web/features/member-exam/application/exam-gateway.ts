import type { AttemptView, SubmitResponse } from '../../../../shared/api/index.js';
import type { AnswerPayload } from './answer-saver.js';

/** Port: everything the exam-taking flow needs from the server. Failures reject with `ApiError`. */
export interface ExamGateway {
  /** The member starts their (only) attempt in the active session. */
  startAttempt(): Promise<void>;
  getAttempt(attemptId: number): Promise<AttemptView>;
  saveAnswer(attemptId: number, questionId: number, payload: AnswerPayload): Promise<void>;
  submitAttempt(attemptId: number): Promise<SubmitResponse>;
  /** After submitting: ask the mentor to reopen the essay questions (PRODUCT.md §7.21). */
  requestEdit(attemptId: number, reason: string): Promise<void>;
  /** The member is done editing the essays the mentor reopened. */
  finishEdit(attemptId: number): Promise<void>;
}
