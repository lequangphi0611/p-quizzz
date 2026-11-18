import type { GradeResponse, GradingView, SessionDetail } from '../../../../shared/api/index.js';

/** Port: what the essay-grading page needs from the server (mentor endpoints). Failures reject with `ApiError`. */
export interface GradingGateway {
  getGrading(sessionId: number): Promise<GradingView>;
  getSession(sessionId: number): Promise<SessionDetail>;
  grade(answerId: number, grade: { score: number; feedback?: string; aiUse?: 'accepted' | 'edited' }): Promise<GradeResponse>;
  /** "Hoàn tác": back to ungraded. */
  clearGrade(answerId: number): Promise<GradeResponse>;
  finalize(sessionId: number): Promise<void>;
  /** "AI chấm nháp" for one question (or retry some answers). Returns how many were queued. */
  requestAi(sessionId: number, questionId: number, answerIds?: number[]): Promise<{ queued: number }>;
  stopAi(sessionId: number, questionId: number): Promise<{ stopped: number }>;
}
