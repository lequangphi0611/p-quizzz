import type { DiscussionView, GradeResponse } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { DiscussionGateway } from '../application/discussion-gateway.js';

export class HttpDiscussionGateway implements DiscussionGateway {
  constructor(private http: HttpClient) {}

  getView(sessionId: number): Promise<DiscussionView> { return this.http.get<DiscussionView>(`/api/admin/sessions/${sessionId}/discussion`); }
  gradeAnswer(answerId: number, grade: { score: number; feedback?: string }): Promise<GradeResponse> { return this.http.put<GradeResponse>(`/api/admin/answers/${answerId}/grade`, grade); }
  async finalize(sessionId: number): Promise<void> { await this.http.post(`/api/admin/sessions/${sessionId}/finalize`); }
}
