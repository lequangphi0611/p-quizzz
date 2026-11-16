import type { ActiveSession, LeaderboardResponse, NetworkInfo, PublicParticipant, ScreenRoom } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { ScreenGateway } from '../application/screen-gateway.js';

export class HttpScreenGateway implements ScreenGateway {
  constructor(private http: HttpClient) {}
  getLatest(): Promise<ActiveSession | null> { return this.http.get<ActiveSession | null>('/api/sessions/latest'); }
  getParticipants(id: number): Promise<PublicParticipant[]> { return this.http.get<PublicParticipant[]>(`/api/sessions/${id}/participants`); }
  getLeaderboard(id: number): Promise<LeaderboardResponse> { return this.http.get<LeaderboardResponse>(`/api/sessions/${id}/leaderboard`); }
  getRoom(): Promise<ScreenRoom> { return this.http.get<ScreenRoom>('/api/screen/room'); }
  async getJoinHosts(): Promise<string[]> { return (await this.http.get<NetworkInfo>('/api/network')).joinHosts; }
}
