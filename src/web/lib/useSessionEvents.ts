import { useEffect, useRef } from 'react';
import { eventStream } from '../app/composition.js';
import type { SessionEventHandlers } from '../shared/events/event-stream.js';

export type { SessionEventHandlers };

/** Subscribe to change signals for a session; pass null to stay disconnected. Leaves on unmount. */
export function useSessionEvents(sessionId: number | null, handlers: SessionEventHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers; // always call the latest handlers without reconnecting
  useEffect(() => {
    if (sessionId === null) return;
    const get = () => ref.current;
    return eventStream.subscribe(sessionId, get);
  }, [sessionId]);
}
