import type { ActiveSession, LeaderboardResponse, PublicParticipant, ScreenRoom } from '../../../../shared/api/index.js';

/** Port: the public, read-only data of the projector page. Failures reject with `ApiError`. */
export interface ScreenGateway {
  /** The active session, else the one that just ended; null when there has never been one. */
  getLatest(): Promise<ActiveSession | null>;
  getParticipants(sessionId: number): Promise<PublicParticipant[]>;
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse>;
  /** The room code; rejects with 403 when this machine is not the mentor's. */
  getRoom(): Promise<ScreenRoom>;
  /** LAN addresses members can type (`/api/network`). */
  getJoinHosts(): Promise<string[]>;
}
