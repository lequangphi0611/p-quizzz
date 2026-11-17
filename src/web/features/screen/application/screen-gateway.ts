import type { ActiveSession, LeaderboardResponse, PublicParticipant, RosterCounts, ScreenRoom, ScreenSessions } from '../../../../shared/api/index.js';

/** Port: the public, read-only data of the projector page. Failures reject with `ApiError`. */
export interface ScreenGateway {
  /** Exam title and status of one session; rejects with 404 when it does not exist. Never the mentor's session name. */
  getSession(sessionId: number): Promise<ActiveSession>;
  /** The sessions `/screen` can follow, with the mentor's names. Rejects with 403 when this machine is not the mentor's. */
  listSessions(): Promise<ScreenSessions>;
  getParticipants(sessionId: number): Promise<PublicParticipant[]>;
  getLeaderboard(sessionId: number): Promise<LeaderboardResponse>;
  /** "Đã vào X/N" of a session limited to a list of emails: numbers only, never who. Null for a free session. */
  getRosterCounts(sessionId: number): Promise<RosterCounts | null>;
  /** The room code of that session; rejects with 403 when this machine is not the mentor's. */
  getRoom(sessionId: number): Promise<ScreenRoom>;
  /** LAN addresses members can type (`/api/network`). */
  getJoinHosts(): Promise<string[]>;
}
