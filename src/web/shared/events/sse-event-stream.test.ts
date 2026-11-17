import { describe, expect, it, vi } from 'vitest';
import { connectAdminEvents, connectSessionEvents, createSessionEventHub, type EventSourceLike } from './sse-event-stream.js';

function fakeSource() {
  const l = new Map<string, (e: { data?: string }) => void>();
  let closed = false;
  const es: EventSourceLike = { addEventListener: (t, f) => void l.set(t, f), close: () => { closed = true; } };
  return { es, fire: (t: string, data?: string) => l.get(t)?.({ data }), isClosed: () => closed };
}

describe('connectSessionEvents', () => {
  it('connects to the session stream and dispatches by event type', () => {
    const src = fakeSource();
    let url = '';
    const handlers = { participants: vi.fn(), session: vi.fn() };
    connectSessionEvents(5, () => handlers, u => { url = u; return src.es; });
    src.fire('participants');
    expect(url).toBe('/api/sessions/5/events');
    expect(handlers.participants).toHaveBeenCalledOnce();
    expect(handlers.session).not.toHaveBeenCalled();
  });

  it('calls every handler once after a reconnect, not on the first open', () => {
    const src = fakeSource();
    const handlers = { session: vi.fn(), participants: vi.fn(), leaderboard: vi.fn() };
    connectSessionEvents(1, () => handlers, () => src.es);
    src.fire('open');
    expect(handlers.session).not.toHaveBeenCalled();
    src.fire('error');
    src.fire('open');
    expect(handlers.session).toHaveBeenCalledOnce();
    expect(handlers.participants).toHaveBeenCalledOnce();
    expect(handlers.leaderboard).toHaveBeenCalledOnce();
    src.fire('open'); // a later plain open does not refetch again
    expect(handlers.session).toHaveBeenCalledOnce();
  });

  it('closes the source on cleanup', () => {
    const src = fakeSource();
    connectSessionEvents(1, () => ({}), () => src.es)();
    expect(src.isClosed()).toBe(true);
  });
});

describe('createSessionEventHub', () => {
  function factory() {
    const opened: { url: string; src: ReturnType<typeof fakeSource> }[] = [];
    return { opened, create: (url: string) => { const src = fakeSource(); opened.push({ url, src }); return src.es; } };
  }

  it('shares one connection per session between subscribers and fans events out to each', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const a = { participants: vi.fn() };
    const b = { participants: vi.fn(), session: vi.fn() };
    hub.subscribe(3, () => a);
    hub.subscribe(3, () => b);
    expect(f.opened).toHaveLength(1);
    f.opened[0]!.src.fire('participants');
    expect(a.participants).toHaveBeenCalledOnce();
    expect(b.participants).toHaveBeenCalledOnce();
    expect(b.session).not.toHaveBeenCalled();
  });

  it('opens a separate connection per session', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    hub.subscribe(1, () => ({}));
    hub.subscribe(2, () => ({}));
    expect(f.opened.map(o => o.url)).toEqual(['/api/sessions/1/events', '/api/sessions/2/events']);
  });

  it('closes only when the last subscriber leaves, and reopens for a later subscriber', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const offA = hub.subscribe(3, () => ({}));
    const offB = hub.subscribe(3, () => ({}));
    offA();
    offA(); // leaving twice is harmless
    expect(f.opened[0]!.src.isClosed()).toBe(false);
    offB();
    expect(f.opened[0]!.src.isClosed()).toBe(true);
    expect(hub.openCount()).toBe(0);
    hub.subscribe(3, () => ({}));
    expect(f.opened).toHaveLength(2);
  });

  it('a subscriber that leaves stops receiving events; the reconnect refetch reaches all remaining ones', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const a = { session: vi.fn() };
    const b = { session: vi.fn() };
    const offA = hub.subscribe(3, () => a);
    hub.subscribe(3, () => b);
    offA();
    const { src } = f.opened[0]!;
    src.fire('error');
    src.fire('open');
    expect(a.session).not.toHaveBeenCalled();
    expect(b.session).toHaveBeenCalledOnce();
  });
});

describe('the mentor stream', () => {
  it('connects once to /api/admin/events and reports which session changed', () => {
    const src = fakeSource();
    let url = '';
    const handlers = { onEvent: vi.fn(), onResync: vi.fn() };
    connectAdminEvents(() => handlers, u => { url = u; return src.es; });
    src.fire('participants', '{"sessionId":7}');
    src.fire('session', '{"sessionId":9}');
    expect(url).toBe('/api/admin/events');
    expect(handlers.onEvent.mock.calls).toEqual([['participants', 7], ['session', 9]]);
  });

  it('ignores malformed payloads, and asks for a resync after a reconnect (not on the first open)', () => {
    const src = fakeSource();
    const handlers = { onEvent: vi.fn(), onResync: vi.fn() };
    connectAdminEvents(() => handlers, () => src.es);
    src.fire('session', 'not json');
    src.fire('session', '{}');
    src.fire('session', '{"sessionId":-1}');
    expect(handlers.onEvent).not.toHaveBeenCalled();
    src.fire('open');
    expect(handlers.onResync).not.toHaveBeenCalled();
    src.fire('error');
    src.fire('open');
    expect(handlers.onResync).toHaveBeenCalledOnce();
  });

  it('the hub shares ONE connection among all subscribers and closes it with the last one', () => {
    const sources: ReturnType<typeof fakeSource>[] = [];
    const hub = createSessionEventHub(() => { const s = fakeSource(); sources.push(s); return s.es; });
    const a = { onEvent: vi.fn(), onResync: vi.fn() }, b = { onEvent: vi.fn(), onResync: vi.fn() };
    const offA = hub.subscribeAdmin(() => a);
    const offB = hub.subscribeAdmin(() => b);
    expect(sources).toHaveLength(1);
    expect(hub.openCount()).toBe(1);
    sources[0]!.fire('participants', '{"sessionId":3}');
    expect(a.onEvent).toHaveBeenCalledWith('participants', 3);
    expect(b.onEvent).toHaveBeenCalledWith('participants', 3);
    offA();
    expect(sources[0]!.isClosed()).toBe(false);
    offB();
    expect(sources[0]!.isClosed()).toBe(true);
    expect(hub.openCount()).toBe(0);
  });

  it('many open sessions still cost the mentor page only one admin connection', () => {
    const hub = createSessionEventHub(() => fakeSource().es);
    for (let i = 0; i < 5; i++) hub.subscribeAdmin(() => ({ onEvent: vi.fn(), onResync: vi.fn() }));
    expect(hub.openCount()).toBe(1);
  });
});
