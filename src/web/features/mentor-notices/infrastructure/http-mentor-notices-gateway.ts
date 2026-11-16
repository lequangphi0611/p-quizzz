import type { SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { MentorNoticesGateway } from '../application/mentor-notices-gateway.js';

export class HttpMentorNoticesGateway implements MentorNoticesGateway {
  constructor(private http: HttpClient) {}
  listActive(): Promise<SessionSummary[]> { return this.http.get<SessionSummary[]>('/api/admin/sessions?active=true'); }
  getSession(id: number): Promise<SessionDetail> { return this.http.get<SessionDetail>(`/api/admin/sessions/${id}`); }
  async approveParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/approve`); }
  async answerRejoin(requestId: number, answer: 'keep' | 'takeover' | 'reject'): Promise<void> {
    await this.http.post(`/api/admin/rejoin-requests/${requestId}/${answer === 'keep' ? 'approve-keep' : answer === 'takeover' ? 'approve-takeover' : 'reject'}`);
  }
  async resolveEditRequest(id: number, decision: 'approve' | 'reject'): Promise<void> { await this.http.post(`/api/admin/participants/${id}/edit-request/${decision}`); }
}
