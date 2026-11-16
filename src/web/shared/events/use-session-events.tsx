import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { AdminEventHandlers, EventStream, SessionEventHandlers } from './event-stream.js';

const Ctx = createContext<EventStream | null>(null);

/** The composition root (`app/`) provides the EventStream implementation. */
export const EventStreamProvider = ({ stream, children }: { stream: EventStream; children: ReactNode }) => <Ctx.Provider value={stream}>{children}</Ctx.Provider>;

/** Subscribe to change signals for a session; pass null to stay disconnected. Leaves on unmount. */
export function useSessionEvents(sessionId: number | null, handlers: SessionEventHandlers) {
  const stream = useContext(Ctx);
  if (!stream) throw new Error('EventStreamProvider is missing above this component');
  const ref = useRef(handlers);
  ref.current = handlers; // always call the latest handlers without reconnecting
  useEffect(() => {
    if (sessionId === null) return;
    return stream.subscribe(sessionId, () => ref.current);
  }, [stream, sessionId]);
}

/** The mentor's single stream (every open session): signals say which session changed. Leaves on unmount. */
export function useAdminEvents(handlers: AdminEventHandlers) {
  const stream = useContext(Ctx);
  if (!stream) throw new Error('EventStreamProvider is missing above this component');
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => stream.subscribeAdmin(() => ref.current), [stream]);
}
