import type { SessionEventType } from '../../../shared/api/index.js';

export type EventListener = (type: SessionEventType) => void;

// In-process pub/sub keyed by session id. Nothing business-related travels through it.
export function createEventBus() {
  const listeners = new Map<number, Set<EventListener>>();
  return {
    publish(sessionId: number, type: SessionEventType) {
      for (const l of [...(listeners.get(sessionId) ?? [])]) l(type);
    },
    /** Returns an unsubscribe function. */
    subscribe(sessionId: number, listener: EventListener): () => void {
      let set = listeners.get(sessionId);
      if (!set) listeners.set(sessionId, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(sessionId);
      };
    },
    listenerCount: (sessionId: number) => listeners.get(sessionId)?.size ?? 0,
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

// The process-wide bus: composition wires it behind `EventPublisher` and `EventSubscriber`.
export const bus = createEventBus();
