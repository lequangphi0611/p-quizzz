import type { GradeResponse, GradingView, SessionDetail } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { GradingGateway } from '../application/grading-gateway.js';

export class HttpGradingGateway implements GradingGateway {
  constructor(private http: HttpClient) {}

  getGrading(sessionId: number): Promise<GradingView> { return this.http.get<GradingView>(`/api/admin/sessions/${sessionId}/grading`); }
  getSession(sessionId: number): Promise<SessionDetail> { return this.http.get<SessionDetail>(`/api/admin/sessions/${sessionId}`); }
  grade(answerId: number, grade: { score: number; feedback?: string }): Promise<GradeResponse> { return this.http.put<GradeResponse>(`/api/admin/answers/${answerId}/grade`, grade); }
  async finalize(sessionId: number): Promise<void> { await this.http.post(`/api/admin/sessions/${sessionId}/finalize`); }
}
