import type { MySession } from '../domain/my-sessions.js';
import type { ActiveSession, JoinResponse, MeResponse, RejoinRequestResponse, RejoinStatusResponse } from '../../../../shared/api/index.js';

/** Port: what the member's home needs from the server. Failures reject with `ApiError`. */
export interface MemberGateway {
  /** Finds the open session for a room code (403 wrong code or not open, 429 too many wrong codes). */
  resolveRoom(roomCode: string): Promise<ActiveSession>;
  /** The member's own state for the session in TokenStore's "current session" (401 unknown token, 403 kicked). */
  getMe(): Promise<MeResponse>;
  /** `email` only for a roster session (the server ignores it otherwise). */
  join(sessionId: number, input: { displayName: string; roomCode: string; email?: string }): Promise<JoinResponse>;
  /** "That email/name is me, let me back in" (PRODUCT.md §7.23). The returned token reads only the request's status until the mentor approves. */
  requestRejoin(sessionId: number, input: { displayName: string; roomCode: string; email?: string }): Promise<RejoinRequestResponse>;
  /** Status of the request whose token is TokenStore's current one. */
  getRejoinStatus(): Promise<RejoinStatusResponse>;
  cancelRejoin(): Promise<void>;
  /** "Sẵn sàng" / "Huỷ sẵn sàng" in the lobby (PRODUCT.md §7.31d); 409 once the 10-second countdown runs. */
  setReady(ready: boolean): Promise<void>;
  /** Exam title and status of one session (public, the projector uses it too); lists "my sessions" (PRODUCT.md §7.29). */
  getPublicSession(sessionId: number): Promise<ActiveSession>;
}

/** Port: the room code is remembered per session so "join again with another name" after a kick needs no retyping. */
export interface RoomCodeMemory {
  remember(sessionId: number, code: string): void;
  recall(sessionId: number): string;
}

/** Port: the sessions this browser joined, kept across tabs and reloads (PRODUCT.md §7.29). Implementations never throw. */
export interface MySessionsStore {
  load(): MySession[];
  save(list: MySession[]): void;
}

/** Default and test double: kept in memory only. */
export class InMemoryMySessionsStore implements MySessionsStore {
  constructor(private list: MySession[] = []) {}
  load(): MySession[] { return this.list; }
  save(list: MySession[]): void { this.list = list; }
}
