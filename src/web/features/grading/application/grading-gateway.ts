import type { GradeResponse, GradingView, SessionDetail } from '../../../../shared/api/index.js';

/** Port: what the essay-grading page needs from the server (mentor endpoints). Failures reject with `ApiError`. */
export interface GradingGateway {
  getGrading(sessionId: number): Promise<GradingView>;
  getSession(sessionId: number): Promise<SessionDetail>;
  grade(answerId: number, grade: { score: number; feedback?: string }): Promise<GradeResponse>;
  finalize(sessionId: number): Promise<void>;
}
