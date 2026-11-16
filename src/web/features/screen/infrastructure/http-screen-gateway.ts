import type { ActiveSession, LeaderboardResponse, NetworkInfo, PublicParticipant, ScreenRoom, ScreenSessions } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { ScreenGateway } from '../application/screen-gateway.js';

export class HttpScreenGateway implements ScreenGateway {
  constructor(private http: HttpClient) {}
  getSession(id: number): Promise<ActiveSession> { return this.http.get<ActiveSession>(`/api/sessions/${id}/public`); }
  listSessions(): Promise<ScreenSessions> { return this.http.get<ScreenSessions>('/api/screen/sessions'); }
  getParticipants(id: number): Promise<PublicParticipant[]> { return this.http.get<PublicParticipant[]>(`/api/sessions/${id}/participants`); }
  getLeaderboard(id: number): Promise<LeaderboardResponse> { return this.http.get<LeaderboardResponse>(`/api/sessions/${id}/leaderboard`); }
  getRoom(id: number): Promise<ScreenRoom> { return this.http.get<ScreenRoom>(`/api/screen/sessions/${id}/room`); }
  async getJoinHosts(): Promise<string[]> { return (await this.http.get<NetworkInfo>('/api/network')).joinHosts; }
}
