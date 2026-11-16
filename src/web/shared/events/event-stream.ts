import type { SessionEventType } from '../../../shared/api/index.js';

export type SessionEventHandlers = Partial<Record<SessionEventType, () => void>>;

/**
 * Port: subscribe to change signals of one session. The signal carries no data; handlers refetch.
 * `getHandlers` is read on every event so callers can swap handlers without reconnecting.
 * Returns the unsubscribe function.
 */
export interface EventStream {
  subscribe(sessionId: number, getHandlers: () => SessionEventHandlers): () => void;
}
