import type { SessionEventType } from '../../../shared/api/index.js';

/** The listening side of `EventPublisher`: the SSE route subscribes through this. Returns an unsubscribe function. */
export interface EventSubscriber {
  subscribe(sessionId: number, listener: (type: SessionEventType) => void): () => void;
}
