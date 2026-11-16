import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { SessionEventType } from '../../../shared/api/index.js';
import type { EventBus } from './event-bus.js';

/** `EventPublisher` backed by the in-process bus that the SSE route subscribes to. */
export class BusEventPublisher implements EventPublisher {
  constructor(private readonly bus: Pick<EventBus, 'publish'>) {}

  async publish(sessionId: number, type: SessionEventType): Promise<void> {
    this.bus.publish(sessionId, type);
  }
}
