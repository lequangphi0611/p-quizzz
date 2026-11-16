import type { ActiveSession, SessionDetail } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { MentorNoticesGateway } from '../application/mentor-notices-gateway.js';

export class HttpMentorNoticesGateway implements MentorNoticesGateway {
  constructor(private http: HttpClient) {}
  getActive(): Promise<ActiveSession | null> { return this.http.get<ActiveSession | null>('/api/sessions/active'); }
  getSession(id: number): Promise<SessionDetail> { return this.http.get<SessionDetail>(`/api/admin/sessions/${id}`); }
  async approveParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/approve`); }
}
