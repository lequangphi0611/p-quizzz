import type { AttemptView, SubmitResponse } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { AnswerPayload } from '../application/answer-saver.js';
import type { ExamGateway } from '../application/exam-gateway.js';

/** ExamGateway over the member API (`/api/me/*`; the participant token is attached by the http client). */
export class HttpExamGateway implements ExamGateway {
  constructor(private http: HttpClient) {}

  async startAttempt(): Promise<void> { await this.http.post('/api/me/attempts'); }
  getAttempt(attemptId: number): Promise<AttemptView> { return this.http.get<AttemptView>(`/api/me/attempts/${attemptId}`); }
  async saveAnswer(attemptId: number, questionId: number, payload: AnswerPayload): Promise<void> { await this.http.put(`/api/me/attempts/${attemptId}/answers/${questionId}`, payload); }
  submitAttempt(attemptId: number): Promise<SubmitResponse> { return this.http.post<SubmitResponse>(`/api/me/attempts/${attemptId}/submit`); }
  async requestEdit(attemptId: number, reason: string): Promise<void> { await this.http.post(`/api/me/attempts/${attemptId}/edit-request`, { reason }); }
  async finishEdit(attemptId: number): Promise<void> { await this.http.post(`/api/me/attempts/${attemptId}/edit-request/finish`); }
}
