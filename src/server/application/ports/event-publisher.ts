import type { SessionEventType } from '../../../shared/api/index.js';

/**
 * Tells everyone watching a session that something changed. The event carries no data: clients refetch.
 * Async like every I/O port, so phase 2 can swap the in-process bus for WebSocket without touching use cases.
 * Publish after the unit of work has committed, never inside it.
 */
export interface EventPublisher {
  publish(sessionId: number, type: SessionEventType): Promise<void>;
}
