import type { SessionEventType } from '../../../shared/api/index.js';

export type SessionEventHandlers = Partial<Record<SessionEventType, () => void>>;

/** What the mentor's single stream reports: which session changed, and how. `resync` = the connection dropped and came back, so anything may have changed. */
export interface AdminEventHandlers {
  onEvent(type: SessionEventType, sessionId: number): void;
  onResync(): void;
}

/**
 * Port: subscribe to change signals of one session. The signal carries no data; handlers refetch.
 * `getHandlers` is read on every event so callers can swap handlers without reconnecting.
 * Returns the unsubscribe function.
 */
export interface EventStream {
  subscribe(sessionId: number, getHandlers: () => SessionEventHandlers): () => void;
  /**
   * The mentor's stream: every session's signals over ONE connection (browsers allow ~6 per origin, so a bell that opened
   * one stream per open session would starve the page). Returns the unsubscribe function.
   */
  subscribeAdmin(getHandlers: () => AdminEventHandlers): () => void;
}
