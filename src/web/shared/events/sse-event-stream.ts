// SSE implementation of the EventStream port.
import { SESSION_EVENT_TYPES } from '../../../shared/api/index.js';
import type { AdminEventHandlers, EventStream, SessionEventHandlers } from './event-stream.js';

// Minimal slice of EventSource we rely on (lets tests inject a fake).
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { data?: string }) => void): void;
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

/**
 * The mentor's stream (`/api/admin/events`): every session's change signals over one connection. Each event carries
 * `{"sessionId":N}`; a reconnect reports `onResync` once because events fired while the connection was down are lost.
 */
export function connectAdminEvents(getHandlers: () => AdminEventHandlers, create: EventSourceFactory = url => new EventSource(url)): () => void {
  const es = create('/api/admin/events');
  let dropped = false;
  for (const type of SESSION_EVENT_TYPES) {
    es.addEventListener(type, event => {
      try {
        const sessionId = Number((JSON.parse(event.data ?? '{}') as { sessionId?: unknown }).sessionId);
        if (Number.isInteger(sessionId) && sessionId > 0) getHandlers().onEvent(type, sessionId);
      } catch { /* a malformed signal is ignored; the next resync repairs any gap */ }
    });
  }
  es.addEventListener('error', () => { dropped = true; });
  es.addEventListener('open', () => {
    if (!dropped) return;
    dropped = false;
    getHandlers().onResync();
  });
  return () => es.close();
}

/**
 * One EventSource per session per tab, shared by every component that listens to it. Each open
 * EventSource holds an HTTP/1.1 connection for its lifetime and browsers allow only 6 per origin,
 * so a page with several listeners (e.g. the mentor's session page plus the notification bell)
 * must not open one each. The connection closes when its last subscriber leaves.
 */
export function createSessionEventHub(create?: EventSourceFactory): EventStream & { openCount(): number } {
  const streams = new Map<number, { subscribers: Set<() => SessionEventHandlers>; close: () => void }>();
  const admin = { subscribers: new Set<() => AdminEventHandlers>(), close: null as (() => void) | null };
  return {
    subscribeAdmin(getHandlers: () => AdminEventHandlers): () => void {
      if (!admin.close) {
        admin.close = connectAdminEvents(() => ({
          onEvent: (type, sessionId) => { for (const get of [...admin.subscribers]) get().onEvent(type, sessionId); },
          onResync: () => { for (const get of [...admin.subscribers]) get().onResync(); },
        }), create);
      }
      admin.subscribers.add(getHandlers);
      return () => {
        if (!admin.subscribers.delete(getHandlers) || admin.subscribers.size > 0) return;
        admin.close?.();
        admin.close = null;
      };
    },
    subscribe(sessionId: number, getHandlers: () => SessionEventHandlers): () => void {
      let stream = streams.get(sessionId);
      if (!stream) {
        const subscribers = new Set<() => SessionEventHandlers>();
        // Fan each event out to the current subscribers (snapshot: a handler may unsubscribe).
        const fanOut = (): SessionEventHandlers =>
          Object.fromEntries(SESSION_EVENT_TYPES.map(t => [t, () => { for (const get of [...subscribers]) get()[t]?.(); }]));
        stream = { subscribers, close: connectSessionEvents(sessionId, fanOut, create) };
        streams.set(sessionId, stream);
      }
      const s = stream;
      s.subscribers.add(getHandlers);
      return () => {
        if (!s.subscribers.delete(getHandlers) || s.subscribers.size > 0) return;
        s.close();
        if (streams.get(sessionId) === s) streams.delete(sessionId);
      };
    },
    openCount: () => streams.size + (admin.close ? 1 : 0),
  };
}
