import type { LeaderboardResponse } from '../../../shared/api/index.js';
import type { HttpClient } from '../api-client/http-client.js';
import type { LeaderboardGateway } from './leaderboard-gateway.js';

export class HttpLeaderboardGateway implements LeaderboardGateway {
  constructor(private http: HttpClient) {}
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse> { return this.http.get<LeaderboardResponse>(`/api/sessions/${sessionId}/leaderboard`); }
}
