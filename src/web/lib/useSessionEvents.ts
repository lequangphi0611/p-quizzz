import { useEffect, useRef } from 'react';
import { SESSION_EVENT_TYPES, type SessionEventType } from '../../shared/api/index.js';

export type SessionEventHandlers = Partial<Record<SessionEventType, () => void>>;

// Minimal slice of EventSource we rely on (lets tests inject a fake).
export interface EventSourceLike {
  addEventListener(type: string, listener: () => void): void;
  close(): void;
}
export type EventSourceFactory = (url: string) => EventSourceLike;

/**
 * Opens the SSE stream and wires handlers. EventSource reconnects by itself; after a reconnect we call
 * every handler once, because events fired while the connection was down are lost.
 */
export function connectSessionEvents(
  sessionId: number,
  getHandlers: () => SessionEventHandlers,
  create: EventSourceFactory = url => new EventSource(url),
): () => void {
  const es = create(`/api/sessions/${sessionId}/events`);
  let dropped = false;
  for (const type of SESSION_EVENT_TYPES) es.addEventListener(type, () => getHandlers()[type]?.());
  es.addEventListener('error', () => { dropped = true; });
  es.addEventListener('open', () => {
    if (!dropped) return;
    dropped = false;
    for (const type of SESSION_EVENT_TYPES) getHandlers()[type]?.();
  });
  return () => es.close();
}

/** Subscribe to change signals for a session; pass null to stay disconnected. Closes on unmount. */
export function useSessionEvents(sessionId: number | null, handlers: SessionEventHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers; // always call the latest handlers without reconnecting
  useEffect(() => {
    if (sessionId === null) return;
    return connectSessionEvents(sessionId, () => ref.current);
  }, [sessionId]);
}
