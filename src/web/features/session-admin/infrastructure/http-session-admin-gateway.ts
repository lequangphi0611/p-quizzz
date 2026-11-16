import type { ExamSummary, LeaderboardResponse, ParticipantReview, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { SessionAction } from '../../../../shared/session-state.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { NewSession, SessionAdminGateway } from '../application/session-admin-gateway.js';

export class HttpSessionAdminGateway implements SessionAdminGateway {
  constructor(private http: HttpClient) {}

  listSessions(): Promise<SessionSummary[]> { return this.http.get<SessionSummary[]>('/api/admin/sessions'); }
  listExams(): Promise<ExamSummary[]> { return this.http.get<ExamSummary[]>('/api/admin/exams'); }
  createSession(input: NewSession): Promise<SessionDetail> { return this.http.post<SessionDetail>('/api/admin/sessions', input); }
  getSession(id: number): Promise<SessionDetail> { return this.http.get<SessionDetail>(`/api/admin/sessions/${id}`); }
  runAction(id: number, action: SessionAction): Promise<SessionDetail> { return this.http.post<SessionDetail>(`/api/admin/sessions/${id}/${action}`); }
  async approveParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/approve`); }
  async kickParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/kick`); }
  async renameParticipant(id: number, displayName: string): Promise<void> { await this.http.patch(`/api/admin/participants/${id}`, { displayName }); }
  getParticipantReview(id: number): Promise<ParticipantReview> { return this.http.get<ParticipantReview>(`/api/admin/participants/${id}/review`); }
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse> { return this.http.get<LeaderboardResponse>(`/api/sessions/${sessionId}/leaderboard`); }
}
