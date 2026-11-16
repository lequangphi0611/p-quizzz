import type { LeaderboardResponse } from '../../../shared/api/index.js';

/** Port: the ranking of one session (public endpoint). Failures reject with `ApiError`. */
export interface LeaderboardGateway {
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse>;
}
