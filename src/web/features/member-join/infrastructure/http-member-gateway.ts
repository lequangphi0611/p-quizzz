import type { ActiveSession, JoinResponse, MeResponse } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { MemberGateway } from '../application/member-gateway.js';

export class HttpMemberGateway implements MemberGateway {
  constructor(private http: HttpClient) {}
  resolveRoom(roomCode: string): Promise<ActiveSession> { return this.http.post<ActiveSession>('/api/rooms/resolve', { roomCode }); }
  getMe(): Promise<MeResponse> { return this.http.get<MeResponse>('/api/me'); }
  join(sessionId: number, input: { displayName: string; roomCode: string }): Promise<JoinResponse> { return this.http.post<JoinResponse>(`/api/sessions/${sessionId}/join`, input); }
}
