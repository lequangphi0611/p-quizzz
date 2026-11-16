import type { AttemptView, SubmitResponse } from '../../../../shared/api/index.js';
import type { AnswerPayload } from './answer-saver.js';

/** Port: everything the exam-taking flow needs from the server. Failures reject with `ApiError`. */
export interface ExamGateway {
  /** The member starts their (only) attempt in the active session. */
  startAttempt(): Promise<void>;
  getAttempt(attemptId: number): Promise<AttemptView>;
  saveAnswer(attemptId: number, questionId: number, payload: AnswerPayload): Promise<void>;
  submitAttempt(attemptId: number): Promise<SubmitResponse>;
}
