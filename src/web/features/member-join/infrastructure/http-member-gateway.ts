import type { ActiveSession, JoinResponse, MeResponse, RejoinRequestResponse, RejoinStatusResponse, ResolvedRoom } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { MemberGateway } from '../application/member-gateway.js';

export class HttpMemberGateway implements MemberGateway {
  constructor(private http: HttpClient) {}
  resolveRoom(roomCode: string): Promise<ResolvedRoom> { return this.http.post<ResolvedRoom>('/api/rooms/resolve', { roomCode }); }
  getMe(): Promise<MeResponse> { return this.http.get<MeResponse>('/api/me'); }
  join(sessionId: number, input: { displayName: string; roomCode: string; email?: string }): Promise<JoinResponse> { return this.http.post<JoinResponse>(`/api/sessions/${sessionId}/join`, input); }
  requestRejoin(sessionId: number, input: { displayName: string; roomCode: string; email?: string }): Promise<RejoinRequestResponse> { return this.http.post<RejoinRequestResponse>(`/api/sessions/${sessionId}/rejoin-requests`, input); }
  getRejoinStatus(): Promise<RejoinStatusResponse> { return this.http.get<RejoinStatusResponse>('/api/rejoin/status'); }
  async cancelRejoin(): Promise<void> { await this.http.post('/api/rejoin/cancel'); }
  async setReady(ready: boolean): Promise<void> { await this.http.put('/api/me/ready', { ready }); }
  getPublicSession(sessionId: number): Promise<ActiveSession> { return this.http.get<ActiveSession>(`/api/sessions/${sessionId}/public`); }
}
