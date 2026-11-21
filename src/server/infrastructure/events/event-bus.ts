import type { SessionEventType } from '../../../shared/api/index.js';

export type EventListener = (type: SessionEventType) => void;
export type AllEventsListener = (sessionId: number, type: SessionEventType) => void;
export type TrainingListener = (trainingId: number) => void;

// In-process pub/sub keyed by session id. Nothing business-related travels through it.
export function createEventBus() {
  const listeners = new Map<number, Set<EventListener>>();
  const everyone = new Set<AllEventsListener>();
  const trainingListeners = new Set<TrainingListener>();
  return {
    publish(sessionId: number, type: SessionEventType) {
      for (const l of [...(listeners.get(sessionId) ?? [])]) l(type);
      for (const l of [...everyone]) l(sessionId, type);
    },
    /** A training changed (its own channel: training ids and session ids are unrelated numbers). */
    publishTraining(trainingId: number) {
      for (const l of [...trainingListeners]) l(trainingId);
    },
    /** Returns an unsubscribe function. */
    subscribeTraining(listener: TrainingListener): () => void {
      trainingListeners.add(listener);
      return () => void trainingListeners.delete(listener);
    },
    /** Returns an unsubscribe function. */
    subscribeAll(listener: AllEventsListener): () => void {
      everyone.add(listener);
      return () => void everyone.delete(listener);
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
    allListenerCount: () => everyone.size,
    trainingListenerCount: () => trainingListeners.size,
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

// The process-wide bus: composition wires it behind `EventPublisher` and `EventSubscriber`.
export const bus = createEventBus();
