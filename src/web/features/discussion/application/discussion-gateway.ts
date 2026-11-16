import type { DiscussionView, GradeResponse } from '../../../../shared/api/index.js';

/** Port: what the discussion screen needs from the server (mentor endpoints). Failures reject with `ApiError`. */
export interface DiscussionGateway {
  getView(sessionId: number): Promise<DiscussionView>;
  gradeAnswer(answerId: number, grade: { score: number; feedback?: string }): Promise<GradeResponse>;
  finalize(sessionId: number): Promise<void>;
}
