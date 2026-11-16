import { createEventBus } from './infrastructure/events/event-bus.js';

export { createEventBus, type EventBus, type EventListener } from './infrastructure/events/event-bus.js';

// Legacy: the process-wide bus that services publish to directly (`import { publish } from '../events.js'`)
// and the SSE route subscribes to. New code publishes through the `EventPublisher` port, which composition
// backs with this same bus. Goes away with the last service (P3-5).
export const bus = createEventBus();
export const publish = bus.publish;
export const subscribe = bus.subscribe;
