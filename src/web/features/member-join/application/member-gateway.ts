import type { ActiveSession, JoinResponse, MeResponse } from '../../../../shared/api/index.js';

/** Port: what the member's home needs from the server. Failures reject with `ApiError`. */
export interface MemberGateway {
  /** The session open for joining or running; null when none. */
  getActive(): Promise<ActiveSession | null>;
  /** The member's own state for the session in TokenStore's "current session" (401 unknown token, 403 kicked). */
  getMe(): Promise<MeResponse>;
  join(sessionId: number, input: { displayName: string; roomCode: string }): Promise<JoinResponse>;
}

/** Port: the room code is remembered per session so "join again with another name" after a kick needs no retyping. */
export interface RoomCodeMemory {
  remember(sessionId: number, code: string): void;
  recall(sessionId: number): string;
}
