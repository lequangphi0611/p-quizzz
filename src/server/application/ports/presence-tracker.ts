import type { Connection } from '../../domain/participant/presence.js';

/** Who is still talking to the server. In memory on purpose: it is a few seconds of state, and a restart ends every connection anyway. */
export interface PresenceTracker {
  /** Record a sign of life (a request from that member's browser). */
  touch(participantId: number): void;
  connectionOf(participantId: number): Connection;
}
