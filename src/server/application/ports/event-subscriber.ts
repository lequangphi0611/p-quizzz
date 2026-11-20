import type { SessionEventType } from '../../../shared/api/index.js';

/** The listening side of `EventPublisher`: the SSE route subscribes through this. Returns an unsubscribe function. */
export interface EventSubscriber {
  subscribe(sessionId: number, listener: (type: SessionEventType) => void): () => void;
  /** Every session's events, for the mentor's single stream (one connection however many sessions are open). */
  subscribeAll(listener: (sessionId: number, type: SessionEventType) => void): () => void;
  /** The mentor's stream also hears training changes (a training id, no data). */
  subscribeTraining(listener: (trainingId: number) => void): () => void;
}
