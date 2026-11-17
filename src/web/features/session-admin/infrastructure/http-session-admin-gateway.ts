import type { ExamSummary, GroupSummary, NetworkInfo, LeaderboardResponse, ParticipantReview, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { SessionAction } from '../../../../shared/session-state.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { NewSession, SessionAdminGateway } from '../application/session-admin-gateway.js';

export class HttpSessionAdminGateway implements SessionAdminGateway {
  constructor(private http: HttpClient) {}

  listSessions(): Promise<SessionSummary[]> { return this.http.get<SessionSummary[]>('/api/admin/sessions'); }
  listExams(): Promise<ExamSummary[]> { return this.http.get<ExamSummary[]>('/api/admin/exams'); }
  createSession(input: NewSession): Promise<SessionDetail> { return this.http.post<SessionDetail>('/api/admin/sessions', input); }
  listGroups(): Promise<GroupSummary[]> { return this.http.get<GroupSummary[]>('/api/admin/groups'); }
  addRoster(sessionId: number, emails: string[]): Promise<SessionDetail> { return this.http.post<SessionDetail>(`/api/admin/sessions/${sessionId}/roster`, { emails }); }
  saveGroup(sessionId: number, name: string): Promise<{ id: number; name: string; emailCount: number }> { return this.http.post(`/api/admin/sessions/${sessionId}/save-group`, { name }); }
  getSession(id: number): Promise<SessionDetail> { return this.http.get<SessionDetail>(`/api/admin/sessions/${id}`); }
  runAction(id: number, action: SessionAction): Promise<SessionDetail> { return this.http.post<SessionDetail>(`/api/admin/sessions/${id}/${action}`); }
  async approveParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/approve`); }
  async kickParticipant(id: number): Promise<void> { await this.http.post(`/api/admin/participants/${id}/kick`); }
  async resolveEditRequest(id: number, decision: 'approve' | 'reject'): Promise<void> { await this.http.post(`/api/admin/participants/${id}/edit-request/${decision}`); }
  async renameParticipant(id: number, displayName: string): Promise<void> { await this.http.patch(`/api/admin/participants/${id}`, { displayName }); }
  async answerRejoin(requestId: number, answer: 'keep' | 'takeover' | 'reject'): Promise<void> {
    await this.http.post(`/api/admin/rejoin-requests/${requestId}/${answer === 'keep' ? 'approve-keep' : answer === 'takeover' ? 'approve-takeover' : 'reject'}`);
  }
  async allowRejoin(participantId: number): Promise<number> { return (await this.http.post<{ until: number }>(`/api/admin/participants/${participantId}/allow-rejoin`)).until; }
  getParticipantReview(id: number): Promise<ParticipantReview> { return this.http.get<ParticipantReview>(`/api/admin/participants/${id}/review`); }
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse> { return this.http.get<LeaderboardResponse>(`/api/sessions/${sessionId}/leaderboard`); }
  async getJoinHosts(): Promise<string[]> { return (await this.http.get<NetworkInfo>('/api/network')).joinHosts; }
}
